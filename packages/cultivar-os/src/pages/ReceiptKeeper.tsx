import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { authHeaders } from '@trace/shared/auth';
import { useBusinessContext } from '@trace/shared/context';
import {
  LineItem,
  ReconcileResult,
  computeReconcile,
} from '../utils/receiptReconciliation';
import { resizeAndCompressImage } from '../utils/imageCompression';
import { toISODate } from '../utils/dateParse';
import { ConflictDialog } from '../components/ConflictDialog';
import { LineItemGrid } from '../components/LineItemGrid';
import { ReceiptsList } from '../components/receipts/ReceiptsList';
import { listVisibleForStep } from '../lib/receiptsList';
import {
  resolveVendor, planVendorWrite, vendorContactFromCapture, describeDocumentNumber,
  VENDORS_SELECT, VENDOR_ALIASES_SELECT,
  type VendorRow, type VendorAliasRow, type VendorChoice, type VendorResolution,
} from '@trace/shared/business-logic';

const TRACE_RECEIPT  = true; // [TRACE:RECEIPT] STD-003 — comment out when David says "proven"
const TRACE_OCR      = true; // [TRACE:OCR] STD-003 — capture + device-detect path
const TRACE_ROUTER   = true; // [TRACE:ROUTER] STD-003 — infer-then-confirm destinations
const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — OCR → scheduled delivery (loop close)

// VERTICALIZATION NOTE: this surface is shared across verticals. These strings are nursery
// defaults until packages/shared/src/config/VerticalConfig.ts lands (CLAUDE.md Housekeeping →
// Vertical Config Extraction). Pull title/subtitle/dropZone from that config per business_type
// then. The old "Capture truck receipts" copy was an Ignition leak onto the nursery dashboard.
const CAPTURE_COPY = {
  title:    'Snap a receipt or invoice',
  subtitle: 'Point, snap — AI reads it for you',
  dropZone: 'Tap or drop a receipt or invoice here',
};

// OCR extraction shape this surface uses. Invoice is a superset of receipt (keeps
// vendor/date/lines/total, adds customer/address/delivery), so a plain expense receipt
// still reads correctly — its customer/delivery fields just come back empty (D-9).
const OCR_SHAPE: 'receipt' | 'invoice' = 'invoice';

// Device-aware capture: mobile → camera-first; desktop → file upload (no camera).
// Combines a coarse-pointer/narrow-viewport check with a UA fallback so a phone in
// landscape or a tablet still resolves to mobile.
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const narrow = window.matchMedia?.('(max-width: 820px)')?.matches ?? false;
  const ua     = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent || '');
  return (coarse && (narrow || ua)) || (ua && narrow);
}
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(detectMobile);
  useEffect(() => {
    const recompute = () => setIsMobile(detectMobile());
    window.addEventListener('resize', recompute);
    const mq = window.matchMedia?.('(max-width: 820px)');
    mq?.addEventListener?.('change', recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      mq?.removeEventListener?.('change', recompute);
    };
  }, []);
  return isMobile;
}

// Service-type inference for a scheduled delivery: a job that INSTALLS/PLANTS (or carries a
// warranty implying installed work) is 'planting'; anything else is a 'delivery_only' drop.
// Best-guess from the invoice line items, always correctable on the confirm screen (D-9).
type ServiceType = 'planting' | 'delivery_only';
function inferServiceType(lines: Array<{ description?: string | null }>): ServiceType {
  const hasPlanting = lines.some(l => /install|warrant|plant/i.test(l.description ?? ''));
  return hasPlanting ? 'planting' : 'delivery_only';
}
const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  planting:      'Planting / installation',
  delivery_only: 'Delivery only',
};

// STD-010: allowed types + size — must mirror the server-side constants in ocr.ts
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const CATEGORIES = ['fuel', 'supplies', 'meals', 'parts', 'equipment', 'maintenance', 'office', 'other'];

type Step = 'idle' | 'uploading' | 'ocr_running' | 'confirm' | 'saving' | 'done' | 'error';

interface OcrAddress { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null; }
interface OcrResult {
  provider: 'gemini' | 'claude';
  parsed: {
    vendor?: string | null;
    date?: string | null;
    amount?: number | null;
    subtotal?: number | null;
    tax?: number | null;
    category?: string | null;
    line_items?: Array<{ description: string; amount: number; sku?: string | null; quantity?: number | null; unit_price?: number | null; uom?: string | null; pack_size?: number | null; pack_unit?: string | null }> | null;
    receipt_number?: string | null;
    payment_method?: string | null;
    // Invoice-shape fields (Wave 2) — null/absent for plain receipts
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    bill_to?: OcrAddress | null;
    ship_to?: OcrAddress | null;
    due_date?: string | null;
    delivery_date?: string | null;
    // VENDOR-SIDE contact (2026-09-04, ledger #273). Asked for in BOTH prompt shapes. Until this
    // build the OCR was asked for NONE of these — every contact field it emitted was CUSTOMER-side,
    // because the prompt was written for sales invoices. Read AND stored: a prompt change alone
    // would have the writer discard them at save, which is exactly #257's defect.
    vendor_phone?: string | null;
    vendor_email?: string | null;
    vendor_website?: string | null;
    vendor_address?: OcrAddress | null;
    /** 🔴 OUR account number WITH them — never their own company number. See ocr.ts's rule. */
    our_account_number?: string | null;
  } | null;
  ocr_raw: any;
  parseError: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  ocr_cost_estimate: number | null;
}

// Invoice fields surfaced for human validation before any write (D-9: validate-before-write)
interface InvoiceFields {
  customerName: string;
  customerKind: 'person' | 'organization'; // OCR-inferred; drives the create-path split (person → first/last, org → whole name)
  customerPhone: string;
  customerEmail: string;
  billLine1: string; billCity: string; billState: string; billZip: string;
  shipLine1: string; shipCity: string; shipState: string; shipZip: string;
  dueDate: string;
  deliveryDate: string;
}
const EMPTY_INVOICE: InvoiceFields = {
  customerName: '', customerKind: 'person', customerPhone: '', customerEmail: '',
  billLine1: '', billCity: '', billState: '', billZip: '',
  shipLine1: '', shipCity: '', shipState: '', shipZip: '',
  dueDate: '', deliveryDate: '',
};

interface EditableFields {
  vendor: string;
  date: string;
  amount: string;
  category: string;
}

export function ReceiptKeeper() {
  const navigate = useNavigate();
  const location = useLocation();
  // Which door opened this flow — 'route' when launched from the delivery/route surface,
  // 'direct' otherwise (the Receipts tile / nav). Observability only; behaviour is identical.
  const enteredFrom = (location.state as { from?: string } | null)?.from ?? 'direct';
  const { businessId } = useBusinessContext();
  const isMobile = useIsMobile();
  const fileInputRef   = useRef<HTMLInputElement>(null); // gallery / file picker (no camera)
  const cameraInputRef = useRef<HTMLInputElement>(null); // mobile camera (capture attr)

  const [step, setStep]                 = useState<Step>('idle');
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64]   = useState<string | null>(null);
  const [mimeType, setMimeType]         = useState<string | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [fileName, setFileName]         = useState<string>('');
  const [ocrResult, setOcrResult]       = useState<OcrResult | null>(null);
  const [fields, setFields]             = useState<EditableFields>({ vendor: '', date: '', amount: '', category: '' });
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(null);
  // 🔴 THE DOCUMENT'S OWN NUMBER — NOW REVIEWABLE BEFORE SAVING (2026-09-04, David's ruling).
  //
  // ⚠️ THIS COMMENT PREVIOUSLY DEFERRED THE FIELD TO A SURFACE THAT CANNOT EDIT IT, AND THE
  //    DEFERRAL IS RECORDED AS A DEFECT RATHER THAN QUIETLY DELETED (tech-debt #180). It read:
  //    "Correcting a misread number belongs to the record's ONE edit surface, /receipts/:id (E1)."
  //    `/receipts/:id` does not edit `receipt_number`. Grepped 2026-09-04: the string appears in
  //    ReceiptsList, receiptsList.ts, this file, systemManagedFields.ts, historyOrder.ts and the
  //    migration — and in NEITHER `ReceiptDetail.tsx` NOR `receiptDetail.ts`. That page edits
  //    line items and the vendor billing preference; nothing else. So the field was editable
  //    NOWHERE while a comment asserted it was editable somewhere.
  //    🔴 A DEFERRAL TO A SURFACE THAT WAS NEVER BUILT READS EXACTLY LIKE A DEFERRAL TO ONE THAT
  //    WAS, and nothing catches the difference — R-26 inside our own corpus, third instance this
  //    week (tech-debt #61's false comment, #145's stale route row, this).
  //
  //    E1 is therefore NOT in play: adding the field here creates no second edit surface, because
  //    there was no first one. And the Golden-Rule friction argument survives intact — in the
  //    normal case the value arrives READ and the owner types nothing.
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  // 🔴 WHAT THE READER READ, BANKED ONCE — the same shape as `line_items_original`, and the
  //    reason the field below can be an honest input rather than an unattributed value.
  //    NULL here while `receiptNumber` is set means the OWNER TYPED IT: we read nothing.
  //    Set only at parse time; never reset by typing (that is the whole point).
  const [receiptNumberOriginal, setReceiptNumberOriginal] = useState<string | null>(null);
  // Set only when the save fell back because 20260903c is not applied yet — drives an honest
  // notice rather than letting a read number vanish without a word.
  const [receiptNumberDropped, setReceiptNumberDropped] = useState(false);

  // ── VENDOR IDENTITY (2026-09-02) — resolve the captured name to a stable id at capture time.
  //    The vendor directory is small (8 distinct strings across the entire database, measured), so
  //    it is loaded once per capture rather than queried per keystroke. An empty or failed read is
  //    not fatal: `resolveVendor` over an empty candidate set returns CREATE, which is the honest
  //    answer when we cannot see what exists — it never links on incomplete information.
  const [vendorRows, setVendorRows]     = useState<VendorRow[]>([]);
  const [vendorAliases, setVendorAliases] = useState<VendorAliasRow[]>([]);
  const [vendorChoice, setVendorChoice] = useState<VendorChoice>(null);

  // Invoice-shape + infer-then-confirm router state (Wave 2)
  const [invoice, setInvoice]           = useState<InvoiceFields>(EMPTY_INVOICE);
  const [docType, setDocType]           = useState<'invoice-customer' | 'receipt'>('receipt');
  const [addCustomer, setAddCustomer]   = useState(false); // destination: create a customer
  const [scheduleDelivery, setScheduleDelivery] = useState(false); // destination: create a dated delivery
  const [serviceType, setServiceType]   = useState<ServiceType>('delivery_only'); // inferred, correctable
  const [customerResult, setCustomerResult] = useState<{ id: string; created: boolean } | null>(null);
  const [customerWarn, setCustomerWarn] = useState<string | null>(null);
  const [deliveryResult, setDeliveryResult] = useState<{ id: string } | null>(null);
  const [deliveryWarn, setDeliveryWarn] = useState<string | null>(null);

  useEffect(() => {
    if (TRACE_OCR) console.log('[TRACE:OCR] device-detect — isMobile:', isMobile, 'layout:', isMobile ? 'camera-first' : 'file-upload', 'shape:', OCR_SHAPE);
  }, [isMobile]);

  useEffect(() => {
    if (TRACE_ROUTER) console.log('[TRACE:ROUTER] invoice capture opened — entered-from:', enteredFrom, 'shape:', OCR_SHAPE);
  }, [enteredFrom]);

  // Vendor directory, loaded once per capture. A failed read leaves both arrays empty, which makes
  // `resolveVendor` answer CREATE — never a LINK on information we could not actually see.
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    void (async () => {
      const [v, a] = await Promise.all([
        supabase.from('vendors')
          .select(VENDORS_SELECT)
          .eq('business_id', businessId)
          // See Vendors.tsx: VENDORS_SELECT is DERIVED (tech-debt #179), so supabase-js can no
          // longer infer the row shape from a literal. Stated at the boundary rather than cast.
          .returns<VendorRow[]>(),
        supabase.from('vendor_aliases')
          .select(VENDOR_ALIASES_SELECT)
          .eq('business_id', businessId),
      ]);
      if (cancelled) return;
      if (TRACE_RECEIPT) console.log('[TRACE:VENDOR] directory loaded — vendors:', v.data?.length ?? 0,
        'aliases:', a.data?.length ?? 0, v.error ? `read failed: ${v.error.message}` : '');
      setVendorRows(v.data ?? []);
      setVendorAliases((a.data ?? []) as VendorAliasRow[]);
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  // The resolution is DERIVED, never stored — it must follow the vendor field as the owner edits it,
  // and a stale resolution is how a link gets written against a name nobody typed.
  const vendorResolution: VendorResolution = resolveVendor({
    capturedName: fields.vendor,
    vendors: vendorRows,
    aliases: vendorAliases,
  });

  // Line items state — user-editable grid from OCR output
  const [lineItems, setLineItems]               = useState<LineItem[]>([]);
  // The OCR snapshot, written ONCE to `line_items_original` and never again (enforced from
  // 2026-09-02 by the trg_receipts_snapshot_and_line_guard trigger, not merely by intent). Typed
  // with all five keys because that is what it has always actually held — measured 141 of 141.
  const [lineItemsOriginal, setLineItemsOriginal] =
    useState<Array<{ description: string; amount: number; quantity?: number | null; unit_price?: number | null; sku?: string | null; uom?: string | null; pack_size?: number | null; pack_unit?: string | null }> | null>(null);
  const [amountOriginal, setAmountOriginal]     = useState<number | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // STD-010: file validation (client-side mirror of server enforcement)
  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type not accepted: ${file.type || 'unknown'}. Use JPEG, PNG, WEBP, HEIC, or PDF.`;
    }
    if (file.size > MAX_BYTES) {
      return `File too large (${Math.round(file.size / 1024)}KB). Max: ${MAX_MB}MB.`;
    }
    return null;
  }

  async function handleFileSelect(file: File) {
    const err = validateFile(file);
    if (err) { setErrorMsg(err); return; }

    setErrorMsg(null);
    setFileName(file.name);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }

    const { base64, sizeBytes, mimeType: mt } = await resizeAndCompressImage(file);
    setImageBase64(base64);
    setMimeType(mt);
    setFileSizeBytes(sizeBytes);

    if (TRACE_OCR) console.log('[TRACE:OCR] capture —', isMobile ? 'mobile' : 'desktop', 'name:', file.name, 'original:', file.size, 'compressed:', sizeBytes, 'type:', mt);
    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] file selected — name:', file.name, 'original:', file.size, 'compressed:', sizeBytes, 'type:', mt);
  }

  async function handleRunOCR() {
    if (!imageBase64 || !mimeType || !businessId) return;

    setStep('ocr_running');
    setErrorMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMsg('Not authenticated'); setStep('error'); return; }

    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] sending to OCR — businessId:', businessId, 'shape:', OCR_SHAPE);

    try {
      const res = await fetch('/api/receipts/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ businessId, userId: user.id, imageBase64, mimeType, fileSizeBytes, shape: OCR_SHAPE }),
      });

      let data: any = {};
      try { data = await res.json(); } catch { /* non-JSON body (502 etc.) */ }

      if (!res.ok || !data.ok) {
        const msg = data.error ?? (res.status === 502 ? 'OCR timed out — try a smaller or clearer photo' : 'OCR failed — try again');
        setErrorMsg(msg);
        setStep('error');
        return;
      }

      if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] OCR result — provider:', data.provider, 'vendor:', data.parsed?.vendor, 'amount:', data.parsed?.amount, 'line_items:', data.parsed?.line_items?.length ?? 0, 'tokens:', data.inputTokens, '+', data.outputTokens, 'cost:', data.ocr_cost_estimate);

      setOcrResult(data);

      // Pre-fill editable fields from OCR output
      setFields({
        vendor:   data.parsed?.vendor   ?? '',
        date:     toISODate(data.parsed?.date),   // normalize → YYYY-MM-DD for <input type="date">
        amount:   data.parsed?.amount != null ? Number(data.parsed.amount).toFixed(2) : '',
        category: data.parsed?.category ?? '',
      });
      // Trimmed to null rather than kept as '' — an empty string would read as "the document has
      // a number and it is blank", which is a different claim from "no number was printed" (D-9).
      const readNumber = data.parsed?.receipt_number?.trim() || null;
      setReceiptNumber(readNumber);
      // 🔴 BANK '' — NOT null — WHEN THE READER FOUND NOTHING. NULL is reserved for "nothing was
      //    ever banked for this row" (a pre-column capture, or a browser tab still running an
      //    older bundle), and those are different facts. Conflating them makes the rule tell an
      //    owner she TYPED a number the reader actually read — measured live on LAWNS the day
      //    this shipped. Banked ONCE, here; typing never changes it.
      setReceiptNumberOriginal(readNumber ?? '');

      // Initialize editable line items from OCR
      const ocrLines: Array<{ description: string; amount: number; quantity?: number | null; unit_price?: number | null; sku?: string | null; uom?: string | null; pack_size?: number | null; pack_unit?: string | null }> =
        data.parsed?.line_items ?? [];
      const initialLineItems: LineItem[] = ocrLines.map(item => ({
        id:          crypto.randomUUID(),
        description: item.description ?? '',
        amount:      item.amount != null ? Number(item.amount).toFixed(2) : '',
        // Carried, not edited — see the LineItem header. Dropping these on save is what left the
        // Sudderth rate ($35.00 against 20.72) recoverable only from the snapshot.
        quantity:    item.quantity   ?? null,
        unit_price:  item.unit_price ?? null,
        sku:         item.sku        ?? null,
        uom:         item.uom        ?? null,
        pack_size:   item.pack_size  ?? null,
        pack_unit:   item.pack_unit  ?? null,
      }));
      // Inject tax as a line item when OCR captured it and it's not already in the line items
      const parsedTax: number | null = data.parsed?.tax ?? null;
      const taxAlreadyInLines = ocrLines.some((l: any) => /tax/i.test(l.description ?? ''));
      if (parsedTax != null && !taxAlreadyInLines) {
        initialLineItems.push({
          id: crypto.randomUUID(), description: 'Tax', amount: Number(parsedTax).toFixed(2),
          quantity: null, unit_price: null, sku: null, uom: null, pack_size: null, pack_unit: null,
        });
      }
      setLineItems(initialLineItems);
      setLineItemsOriginal(ocrLines.length > 0 ? ocrLines : null);
      setAmountOriginal(data.parsed?.amount ?? null);

      // ── Invoice fields + infer-then-confirm router (Wave 2) ──────────────
      const p = data.parsed ?? {};
      const inv: InvoiceFields = {
        customerName:  p.customer_name  ?? '',
        // OCR classifies person vs organization; default 'person' for any other/absent value.
        customerKind:  p.customer_kind === 'organization' ? 'organization' : 'person',
        customerPhone: p.customer_phone ?? '',
        customerEmail: p.customer_email ?? '',
        billLine1: p.bill_to?.line1 ?? '', billCity: p.bill_to?.city ?? '', billState: p.bill_to?.state ?? '', billZip: p.bill_to?.zip ?? '',
        shipLine1: p.ship_to?.line1 ?? '', shipCity: p.ship_to?.city ?? '', shipState: p.ship_to?.state ?? '', shipZip: p.ship_to?.zip ?? '',
        dueDate:      toISODate(p.due_date),       // normalize → YYYY-MM-DD for <input type="date">
        deliveryDate: toISODate(p.delivery_date),
      };
      setInvoice(inv);

      // [TRACE:OCR] date parse — raw (as OCR returned) vs normalized ISO, so the next
      // test is auditable. A raw value present but ISO empty = unparseable format, not a read miss.
      if (TRACE_OCR) console.log('[TRACE:OCR] date parse —',
        'date:', JSON.stringify(p.date), '→', JSON.stringify(toISODate(p.date)),
        '| due:', JSON.stringify(p.due_date), '→', JSON.stringify(inv.dueDate),
        '| delivery:', JSON.stringify(p.delivery_date), '→', JSON.stringify(inv.deliveryDate));

      // Inference: a customer name (with or without an address) → looks like an invoice
      // for a customer; otherwise treat as a plain expense receipt. Best-guess pre-check,
      // always overridable by the user on the confirm screen.
      const hasCustomer = !!inv.customerName.trim();
      const inferred: 'invoice-customer' | 'receipt' = hasCustomer ? 'invoice-customer' : 'receipt';
      // A delivery needs a customer to link to + somewhere to go: suggest scheduling when
      // we have a customer AND a delivery date or a ship-to address. Best-guess, overridable.
      const suggestDelivery = hasCustomer && (!!inv.deliveryDate || !!inv.shipLine1.trim());
      const inferredService = inferServiceType(ocrLines);
      setServiceType(inferredService);
      setDocType(inferred);
      setAddCustomer(hasCustomer || suggestDelivery);
      setScheduleDelivery(suggestDelivery);
      setCustomerResult(null);
      setCustomerWarn(null);
      setDeliveryResult(null);
      setDeliveryWarn(null);
      if (TRACE_ROUTER) console.log('[TRACE:ROUTER] customer_kind classified:', inv.customerKind,
        '— name:', inv.customerName || '(none)', '(raw customer_kind:', JSON.stringify(p.customer_kind) + ')');
      if (TRACE_ROUTER) console.log('[TRACE:ROUTER] inferred docType:', inferred,
        '— customer:', inv.customerName || '(none)',
        'hasAddress:', !!(inv.billLine1 || inv.shipLine1),
        'deliveryDate:', inv.deliveryDate || '(none)',
        'preCheck addCustomer:', hasCustomer || suggestDelivery,
        'preCheck scheduleDelivery:', suggestDelivery);

      setStep('confirm');
    } catch (err: any) {
      console.error('[TRACE:RECEIPT] OCR fetch error:', err.message);
      setErrorMsg('Network error — check your connection');
      setStep('error');
    }
  }

  // Component-level reconcileState — drives the live readout below the line items grid
  const reconcileState: ReconcileResult | null = step === 'confirm' ? computeReconcile(lineItems, fields.amount) : null;

  // Line item mutation helpers
  function addLineItem() {
    setLineItems(prev => [...prev, { id: crypto.randomUUID(), description: '', amount: '' }]);
  }
  function updateLineItem(id: string, field: 'description' | 'amount', value: string) {
    setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }
  function deleteLineItem(id: string) {
    setLineItems(prev => prev.filter(item => item.id !== id));
  }

  // KIND-1: count line item rows that differ from OCR original
  function countEditedLineItems(): number {
    if (!lineItemsOriginal || lineItemsOriginal.length === 0) {
      return lineItems.length; // all are manual additions
    }
    let count = 0;
    lineItems.forEach((item, idx) => {
      const orig = lineItemsOriginal[idx];
      if (!orig) { count++; return; } // added row
      if (item.description.trim() !== (orig.description ?? '').trim()) count++;
      else if (parseFloat(item.amount) !== orig.amount) count++;
    });
    if (lineItemsOriginal.length > lineItems.length) {
      count += lineItemsOriginal.length - lineItems.length; // deleted rows
    }
    return count;
  }

  // KIND-1: accept_vs_edit — detect any edits relative to OCR output
  function detectAcceptVsEdit(): 'accepted_as_is' | 'edited' {
    const p = ocrResult?.parsed;
    if (!p) return 'edited';
    const vendorChanged    = fields.vendor.trim()   !== (p.vendor   ?? '').trim();
    const dateChanged      = fields.date.trim()      !== (p.date     ?? '').trim();
    const amountChanged    = fields.amount.trim()    !== (p.amount != null ? String(p.amount) : '');
    const categoryChanged  = fields.category.trim()  !== (p.category ?? '').trim();
    const lineItemsEdited  = countEditedLineItems() > 0;
    return (vendorChanged || dateChanged || amountChanged || categoryChanged || lineItemsEdited)
      ? 'edited'
      : 'accepted_as_is';
  }

  // Shared save helper — used by both normal confirm path and conflict override path
  async function doSave(opts: { reconcileState: ReconcileResult; overriddenAt: string | null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMsg('Not authenticated'); setStep('error'); return; }

    const acceptVsEdit    = detectAcceptVsEdit();
    const editedLineCount = countEditedLineItems();

    // STD-010: per-tenant storage path — receipts/{business_id}/{receipt_id}
    const receiptId = crypto.randomUUID();
    let image_url: string | null = null;

    if (imageBase64 && mimeType) {
      try {
        const ext         = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
        const storagePath = `${businessId}/${receiptId}.${ext}`;

        const binary = atob(imageBase64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });

        const { error: storErr } = await supabase.storage
          .from('receipts')
          .upload(storagePath, blob, { contentType: mimeType, upsert: false });

        if (storErr) {
          console.error('[TRACE:RECEIPT] storage FAILED — row NOT written:', storErr.message);
          setErrorMsg('Photo upload failed — check connection and try again');
          setStep('confirm');
          return;
        }
        image_url = storagePath; // private bucket — generate signed URL at view time
        if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] stored image — path:', storagePath);
      } catch (e: any) {
        console.error('[TRACE:RECEIPT] storage exception — row NOT written:', e.message);
        setErrorMsg('Photo upload failed — check connection and try again');
        setStep('confirm');
        return;
      }
    }

    const parsedAmount = parseFloat(fields.amount);
    const rs = opts.reconcileState;

    // Build final line_items from current editable state (owner-confirmed, not raw OCR)
    // 🔴 ALL FIVE KEYS, AND A BLANK AMOUNT STAYS BLANK. Two corrections in one line:
    // (a) quantity / unit_price / sku are emitted instead of dropped — `line_items` had carried
    //     two keys on 171 of 171 stored lines while the read carried five;
    // (b) `parseFloat(item.amount) || 0` turned an EMPTY amount into a real-looking $0.00, which
    //     is a fabricated measurement (D-9) and would then reconcile as though the line were free.
    //     Absent stays absent; the detail view and `edit_receipt_line_items` both report a line
    //     with no amount as unreconcilable rather than summing it as zero.
    const finalLineItems = lineItems
      .filter(item => item.description.trim() || item.amount.trim())
      .map(item => {
        const parsed = parseFloat(item.amount);
        return {
          description: item.description.trim(),
          amount:      Number.isFinite(parsed) ? parsed : null,
          quantity:    item.quantity   ?? null,
          unit_price:  item.unit_price ?? null,
          sku:         item.sku        ?? null,
          uom:         item.uom        ?? null,
          pack_size:   item.pack_size  ?? null,
          pack_unit:   item.pack_unit  ?? null,
        };
      });

    // Reconcile status mapping: only 'large_mismatch' becomes 'large_mismatch_overridden' in DB
    const dbReconcileStatus: string | null = rs.status === 'no_lines'
      ? null
      : opts.overriddenAt ? 'large_mismatch_overridden' : rs.status;

    const headerAmountEdited: boolean | null = amountOriginal !== null
      ? parseFloat(fields.amount) !== amountOriginal
      : null;

    // ── VENDOR IDENTITY — resolve to a stable id BEFORE the receipt is written, so the link lands
    //    with the row rather than in a second pass that can half-happen.
    //
    //    🔴 EVERY FAILURE HERE IS NON-FATAL AND THE RECEIPT STILL SAVES with vendor_id null. That
    //    is §6 r6 applied to identity: a document in hand is worth more than a link, and a null
    //    vendor_id is the honest state every pre-existing row is already in. It is never a reason
    //    to lose a capture.
    let resolvedVendorId: string | null = null;
    try {
      const plan = planVendorWrite(vendorResolution, vendorChoice, fields.vendor);
      if (TRACE_RECEIPT) console.log('[TRACE:VENDOR] plan —', plan.reasoning,
        'link:', plan.linkToVendorId, 'create:', plan.createVendorNamed, 'alias:', plan.recordAlias);

      if (plan.linkToVendorId) {
        resolvedVendorId = plan.linkToVendorId;
        if (plan.recordAlias) {
          // source='capture': a human confirmed this at the moment of capture. Never written by an
          // inference — planVendorWrite only emits an alias when the owner answered "same as".
          const al = await supabase.from('vendor_aliases').insert({
            business_id: businessId, vendor_id: plan.linkToVendorId,
            alias: plan.recordAlias, source: 'capture',
          });
          if (TRACE_RECEIPT) console.log('[TRACE:VENDOR] alias recorded —', plan.recordAlias,
            al.error ? `failed: ${al.error.message}` : 'ok');
        }
      } else if (plan.createVendorNamed) {
        // NOTE: `preferred` is deliberately NOT set here. A vendor created at capture is never
        // born preferred — that is an owner judgement made on the vendor screen, and the INSERT
        // trigger would refuse it from a manager's session anyway.
        //
        // 🔴 THE DOCUMENT'S OWN VENDOR DETAILS ARE KEPT (2026-09-04, ledger #273). Until this
        //    build the insert was `{business_id, name}` and every other column the letterhead
        //    carried — address, phone, our account number — was READ and DISCARDED. Third
        //    instance of extract-and-discard in one week (#257 quantity/unit_price/sku, #270
        //    receipt_number, this). The mapping is a pure function so a probe can reach it;
        //    it populates ON CREATE ONLY and never overwrites an existing row.
        const contact = vendorContactFromCapture(ocrResult?.parsed);
        if (TRACE_RECEIPT) console.log('[TRACE:VENDOR] contact from document —',
          Object.keys(contact).length ? Object.keys(contact).join(',') : '(none on this document)');
        const created = await supabase.from('vendors')
          .insert({ business_id: businessId, name: plan.createVendorNamed, ...contact })
          .select('id').single();
        if (created.error) {
          if (TRACE_RECEIPT) console.log('[TRACE:VENDOR] create failed —', created.error.message);
        } else {
          resolvedVendorId = created.data.id;
          if (TRACE_RECEIPT) console.log('[TRACE:VENDOR] vendor created —', resolvedVendorId);
        }
      }
    } catch (e) {
      if (TRACE_RECEIPT) console.log('[TRACE:VENDOR] resolution threw, saving receipt unresolved —', String(e));
    }

    // 🔴 THE CAPTURE MUST NOT DEPEND ON WHEN THE MIGRATION IS APPLIED (2026-09-03).
    // MEASURED against the live database before this guard existed: an INSERT carrying
    // `receipt_number` while 20260903c is unapplied is REJECTED WHOLE — PostgREST refuses it at
    // the schema cache, `PGRST204: Could not find the 'receipt_number' column of 'receipts'`,
    // before the database is reached. The identical insert WITHOUT the field got as far as the
    // FK check (23503), which is what proves the column — not the payload — is the blocker.
    // So the field does NOT degrade to "dropped": it takes the ENTIRE SAVE DOWN WITH IT, and an
    // owner capturing a receipt in the window between this deploy and the apply would simply be
    // told "Failed to save receipt".
    //
    // That is a deploy-ORDER dependency, and §6 r6 ("integration failure never blocks an order")
    // plus the Golden Rule both say the capture wins. So the write is OPTIMISTIC AND SELF-HEALING:
    // try with the column, and on PGRST204 alone retry once without it. The moment David applies
    // the migration the first attempt succeeds and the fallback goes cold on its own — no second
    // deploy, no coordination, and no window in which capture is broken.
    //
    // ⚠️ THE FALLBACK IS NOT SILENT. Losing the number quietly would be exactly the defect #257
    // fixed for quantity/unit_price/sku — read, then thrown away without saying so. It emits a
    // [TRACE:RECEIPT] line naming the reason, and `receiptNumberDropped` drives an honest notice
    // on the confirmation screen (D-9: the owner is told the number was read but not stored).
    const receiptRow: Record<string, unknown> = {
      id:                      receiptId,
      business_id:             businessId,
      uploaded_by:             user.id,
      image_url,
      ocr_raw:                 ocrResult?.ocr_raw,
      // 🔴 KEPT, never replaced by vendor_id. R-50: the captured string is EVIDENCE of what the
      //    document said, which a resolved id is not — and the list still renders this, verbatim.
      vendor:                  fields.vendor.trim() || null,
      receipt_number:          receiptNumber,
      vendor_id:               resolvedVendorId,
      date:                    fields.date.trim()   || null,
      amount:                  isNaN(parsedAmount)  ? null : parsedAmount,
      category:                fields.category      || null,
      status:                  'confirmed',
      accept_vs_edit:          acceptVsEdit,
      ocr_cost_estimate:       ocrResult?.ocr_cost_estimate ?? null,
      line_items:              finalLineItems.length > 0 ? finalLineItems : null,
      line_items_original:     lineItemsOriginal ?? null,
      amount_original:         amountOriginal ?? null,
      reconcile_status:        dbReconcileStatus,
      reconcile_overridden_at: opts.overriddenAt ?? null,
      reconcile_delta:         rs.status !== 'no_lines' ? Math.round(rs.delta * 100) / 100 : null,
      header_amount_edited:    headerAmountEdited,
    };
    // Banked separately from `receipt_number` so the two can DISAGREE — which is the evidence.
    receiptRow.receipt_number_original = receiptNumberOriginal;

    let { data, error } = await supabase.from('receipts').insert(receiptRow).select('id').single();

    // The ONLY error this retries is a missing column, and only when we actually sent one.
    // Any other failure (FK, RLS refusal, network) is a real failure and is reported as one.
    //
    // ⚠️ TWO COLUMNS CAN NOW BE MISSING, ON TWO DIFFERENT MIGRATIONS (20260903c and 20260904),
    //    and PostgREST names only ONE per rejection — so a single-column strip would fail again
    //    on the second. Both are dropped together: the pair is one piece of evidence and half of
    //    it is not worth a second round-trip.
    if (error?.code === 'PGRST204' && (receiptNumber !== null || receiptNumberOriginal !== null)) {
      if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] a document-number column is not live (PGRST204) —',
        error.message, '— retrying without both; the number was READ but will NOT be stored:', receiptNumber);
      setReceiptNumberDropped(true);
      const { receipt_number: _omitted, receipt_number_original: _omitted2, ...withoutNumber } = receiptRow;
      ({ data, error } = await supabase.from('receipts').insert(withoutNumber).select('id').single());
    }

    if (error) {
      console.error('[TRACE:RECEIPT] DB insert error:', error.message);
      setErrorMsg('Failed to save receipt — ' + error.message);
      setStep('error');
      return;
    }

    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] saved — id:', data?.id,
      'accept_vs_edit:', acceptVsEdit,
      'line_count:', finalLineItems.length,
      'edited_line_count:', editedLineCount,
      'header_amount_edited:', headerAmountEdited,
      'reconcile_status:', dbReconcileStatus,
      'reconcile_delta:', rs.status !== 'no_lines' ? rs.delta.toFixed(2) : 'n/a');

    setSavedReceiptId(data?.id ?? receiptId);

    // ── Router destinations: Add customer (+ optionally Schedule delivery) ──
    // ONE call to /api/customers/create resolves the customer and, when Schedule delivery is
    // checked, creates the single linked delivery in the SAME request. One round-trip → one
    // customer → at most one delivery: no-double-create is now structural, not just careful
    // ordering. Runs AFTER the receipt + image are safely stored, so a failure here never
    // loses the captured document. A delivery needs a customer, so scheduling implies adding.
    const needCustomer = addCustomer || scheduleDelivery;
    if (needCustomer && invoice.customerName.trim() && businessId) {
      // person  → keep the CURRENT split (first token / rest) — it works for people.
      // organization → whole name in first_name, last_name='' (an org has no first/last),
      //   and the endpoint SKIPS the people link (an HOA is not a person) via customer_type.
      const wholeName = invoice.customerName.trim();
      const isOrg = invoice.customerKind === 'organization';
      const nameParts = wholeName.split(/\s+/);
      const first_name = isOrg ? wholeName : nameParts[0];
      const last_name  = isOrg ? '' : nameParts.slice(1).join(' '); // '' when single-word name (customers.last_name is NOT NULL)
      const custBody: any = {
        businessId,
        source: 'ocr-invoice',
        // The captured document becomes a HISTORY ORDER server-side. Only the ID travels: the
        // server re-reads the receipt row it just wrote and derives the money from there, because
        // totals posted in a request body are totals a caller can edit (§1.6 item 10).
        receiptId: data?.id ?? receiptId,
        customer: {
          first_name,
          last_name,
          customer_type: isOrg ? 'organization' : 'person',
          email:         invoice.customerEmail.trim() || null,
          phone:         invoice.customerPhone.trim() || null,
          address_line1: invoice.billLine1.trim() || invoice.shipLine1.trim() || null,
          city:          invoice.billCity.trim()  || invoice.shipCity.trim()  || null,
          state:         invoice.billState.trim() || invoice.shipState.trim() || null,
          zip:           invoice.billZip.trim()   || invoice.shipZip.trim()   || null,
        },
      };
      // Attach the delivery block only when scheduling — prefers ship-to (the destination),
      // falls back to bill-to. The endpoint links it to the SAME resolved customer.
      if (scheduleDelivery) {
        custBody.delivery = {
          deliveryDate: invoice.deliveryDate || null, // ISO YYYY-MM-DD (parses correctly)
          address: {
            line1: invoice.shipLine1.trim() || invoice.billLine1.trim() || null,
            city:  invoice.shipCity.trim()  || invoice.billCity.trim()  || null,
            state: invoice.shipState.trim() || invoice.billState.trim() || null,
            zip:   invoice.shipZip.trim()   || invoice.billZip.trim()   || null,
          },
          serviceType, // 'planting' | 'delivery_only' — inferred from lines, owner-correctable
          notes: `Delivery for ${invoice.customerName.trim()}`,
        };
      }
      if (TRACE_ROUTER) console.log('[TRACE:ROUTER] creating customer from invoice —', isOrg ? 'ORG branch (whole name, no people link):' : 'PERSON branch (split + people link):', first_name, last_name ?? '', 'email:', custBody.customer.email ?? '(none)', 'withDelivery:', scheduleDelivery);
      if (scheduleDelivery && TRACE_DELIVERY) console.log('[TRACE:DELIVERY] scheduling in same call — date:', custBody.delivery.deliveryDate ?? '(none)', 'serviceType:', serviceType,
        'addr:', [custBody.delivery.address.line1, custBody.delivery.address.city, custBody.delivery.address.state, custBody.delivery.address.zip].filter(Boolean).join(', ') || '(none)');
      try {
        // Attach the caller's Bearer token — the server now PROVES the caller before any
        // service-key write (MB_D-015). Without this header the request is refused 403, which is
        // the correct behaviour: an unidentified caller has no authority over a tenant.
        // Uses the ONE shared helper (§6 r8) rather than a local getSession — retrofitted here in
        // commit 2 so the first fix does not become the second copy.
        const cRes  = await fetch('/api/customers/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify(custBody),
        });
        const cData = await cRes.json().catch(() => ({}));
        if (cRes.ok && cData.ok) {
          setCustomerResult({ id: cData.customerId, created: cData.created });
          if (TRACE_ROUTER) console.log('[TRACE:ROUTER] customer', cData.created ? 'created' : 'matched', '— id:', cData.customerId);
          if (scheduleDelivery) {
            if (cData.deliveryId) {
              setDeliveryResult({ id: cData.deliveryId });
              if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] scheduled — id:', cData.deliveryId, 'linked customer:', cData.customerId);
            } else {
              setDeliveryWarn(cData.deliveryError || 'Delivery could not be scheduled — the document and customer were still saved.');
              console.error('[TRACE:DELIVERY] schedule failed:', cData.deliveryError);
            }
          }
        } else {
          setCustomerWarn(cData.error || 'Customer could not be added — the document was still saved.');
          console.error('[TRACE:ROUTER] customer create failed:', cData.error);
        }
      } catch (e: any) {
        setCustomerWarn('Customer could not be added (network) — the document was still saved.');
        console.error('[TRACE:ROUTER] customer create network error:', e.message);
      }
    } else if (scheduleDelivery && !invoice.customerName.trim()) {
      setDeliveryWarn('Delivery needs a customer — add a customer name to schedule it.');
      if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] skipped — no customer name to link');
    }

    setStep('done');
  }

  // Normal confirm path — gate on large mismatch before saving
  async function handleConfirm() {
    if (!businessId || !ocrResult) return;
    setErrorMsg(null);

    const rs = computeReconcile(lineItems, fields.amount);
    if (rs.status === 'large_mismatch') {
      setShowConflictDialog(true);
      return;
    }

    setStep('saving');
    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] confirm — vendor:', fields.vendor, 'amount:', fields.amount, 'line_count:', lineItems.length);
    await doSave({ reconcileState: rs, overriddenAt: null });
  }

  // Override path — owner acknowledged conflict and chose to save anyway ("Tesla bit")
  async function handleSaveAnyway() {
    setShowConflictDialog(false);
    setStep('saving');
    const rs = computeReconcile(lineItems, fields.amount);
    const overriddenAt = new Date().toISOString();
    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] conflict override — delta:', rs.delta.toFixed(2), 'overridden_at:', overriddenAt);
    await doSave({ reconcileState: rs, overriddenAt });
  }

  function handleReset() {
    setStep('idle');
    setErrorMsg(null);
    setImagePreview(null);
    setImageBase64(null);
    setMimeType(null);
    setFileSizeBytes(0);
    setFileName('');
    setOcrResult(null);
    setFields({ vendor: '', date: '', amount: '', category: '' });
    setSavedReceiptId(null);
    setReceiptNumber(null);
    setReceiptNumberDropped(false);
    setLineItems([]);
    setLineItemsOriginal(null);
    setAmountOriginal(null);
    setShowConflictDialog(false);
    setInvoice(EMPTY_INVOICE);
    setDocType('receipt');
    setAddCustomer(false);
    setScheduleDelivery(false);
    setServiceType('delivery_only');
    setCustomerResult(null);
    setCustomerWarn(null);
    setDeliveryResult(null);
    setDeliveryWarn(null);
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const PAGE: React.CSSProperties = {
    minHeight: '100vh',
    background: '#EAF3DE',
    padding: '24px 16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const CARD: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    padding: '24px',
    maxWidth: 480,
    margin: '0 auto',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  };

  const TITLE: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#27500A',
    margin: '0 0 4px',
  };

  const SUBTITLE: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: '0 0 24px',
  };

  const LABEL: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
  };

  const INPUT: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: '0.9375rem',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const SELECT: React.CSSProperties = { ...INPUT, background: '#fff' };

  const BTN_PRIMARY: React.CSSProperties = {
    width: '100%',
    background: '#27500A',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '13px 0',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 16,
  };

  const CAMERA_BTN: React.CSSProperties = {
    width: '100%',
    background: '#27500A',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '28px 0',
    fontSize: '1.25rem',
    fontWeight: 800,
    cursor: 'pointer',
    marginBottom: 12,
    lineHeight: 1.2,
  };

  const BTN_GHOST: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    padding: '11px 0',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  };

  const FIELD_ROW: React.CSSProperties = { marginBottom: 16 };

  const ROUTER_PANEL: React.CSSProperties = {
    background: '#f9fbf7',
    border: '1px solid #cfe3b6',
    borderRadius: 10,
    padding: '14px',
    margin: '4px 0 16px',
  };

  const DEST_ROW: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 0',
    fontSize: '0.9375rem',
    color: '#1f2937',
    cursor: 'pointer',
  };

  const DEST_SUB: React.CSSProperties = { fontSize: '0.75rem', color: '#64748b' };

  const COMING: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#92400e',
    background: '#fef3c7',
    borderRadius: 6,
    padding: '1px 6px',
    marginLeft: 4,
  };

  const TRIPLE_ROW: React.CSSProperties = { display: 'flex', gap: 8 };

  const DROP_ZONE: React.CSSProperties = {
    border: '2px dashed #a7c985',
    borderRadius: 12,
    padding: '32px 16px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#f9fbf7',
    color: '#4b7a2e',
    fontSize: '0.9375rem',
    fontWeight: 600,
    marginBottom: 16,
  };

  const PREVIEW_IMG: React.CSSProperties = {
    width: '100%',
    maxHeight: 240,
    objectFit: 'contain',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    marginBottom: 12,
  };

  const OCR_BOX: React.CSSProperties = {
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 8,
    padding: '12px',
    marginBottom: 16,
    fontSize: '0.8125rem',
    color: '#0c4a6e',
  };

  const DONE_BOX: React.CSSProperties = {
    textAlign: 'center',
    padding: '24px 0',
  };


  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={PAGE}>
      {/* ── THE READ SURFACE ─────────────────────────────────────────────────────────────
          Added 2026-09-01. The seven-state capture wizard below is UNCHANGED — this is an
          addition, not a replacement. The list sits ABOVE the capture zone (David's ruling)
          and steps aside while the wizard is mid-flow; `listVisibleForStep` holds that
          decision so it can be asserted, rather than living as a condition in this file.
          `savedReceiptId` is passed as the refresh token: it changes when a capture is
          written, which is what makes the new receipt appear without a reload. */}
      {listVisibleForStep(step) && (
        <ReceiptsList businessId={businessId} refreshToken={savedReceiptId} />
      )}
      <div style={CARD}>
        <h1 style={TITLE}>{CAPTURE_COPY.title}</h1>
        <p style={SUBTITLE}>{CAPTURE_COPY.subtitle}</p>

        {/* ── IDLE / FILE SELECT ─────────────────────────────────── */}
        {/* FLAG: REQ-1 — WIDGET CONSENT-TO-USE (REQUIRED before this step renders):
            When the user activates data entry, present an upfront consent surface covering
            (a) consent to use this tool and (b) how their data is handled. Must appear at
            activation, not buried. Do NOT build this activation step without that surface. */}
        {/* FLAG: REQ-2 — HANDWRITTEN-RECEIPT KNOWN-LIMITATION DISCLOSURE (REQUIRED, same surface as REQ-1):
            The consent surface MUST state that HANDWRITTEN receipts are a known issue and must be
            carefully inspected before saving — handwriting capture is unreliable.
            Evidence (2026-06-11): handwritten Schrock's A/C invoice read all line items as $0.00,
            missed $395 total and "pd Venmo" annotation, fell to Claude fallback. Printed = clean.
            Framing: disclose + require inspection only — no business advice about what to do with the receipt. */}
        {step === 'idle' && (
          <>
            {!imageBase64 ? (
              isMobile ? (
                // ── MOBILE: camera-first. Big tap target → straight to the camera. ──
                <>
                  <button style={CAMERA_BTN} onClick={() => cameraInputRef.current?.click()}>
                    📷 Take Photo
                    <div style={{ fontSize: '0.8125rem', fontWeight: 400, marginTop: 4, opacity: 0.9 }}>
                      Point at the invoice or receipt
                    </div>
                  </button>
                  <button style={BTN_GHOST} onClick={() => fileInputRef.current?.click()}>
                    Choose from photos / files
                  </button>
                </>
              ) : (
                // ── DESKTOP: file upload / drag-drop (no camera). ──
                <div
                  style={DROP_ZONE}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileSelect(f);
                  }}
                >
                  📄 {CAPTURE_COPY.dropZone}
                  <div style={{ fontSize: '0.75rem', color: '#78a55a', marginTop: 6, fontWeight: 400 }}>
                    JPEG · PNG · WEBP · HEIC · PDF · Max {MAX_MB}MB
                  </div>
                </div>
              )
            ) : (
              <>
                {imagePreview && <img src={imagePreview} alt="Document preview" style={PREVIEW_IMG} />}
                {!imagePreview && (
                  <div style={{ ...OCR_BOX, background: '#f9fafb', borderColor: '#e5e7eb', color: '#374151', marginBottom: 12 }}>
                    📄 {fileName} ready for OCR
                  </div>
                )}
              </>
            )}

            {/* Camera input — mobile only path triggers this; capture hints rear camera */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />
            {/* File / gallery input — no capture, so it opens the picker not the camera */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            />

            {errorMsg && (
              <div style={{ color: '#A32D2D', fontSize: '0.875rem', marginBottom: 12, padding: '10px 12px', background: '#fef2f2', borderRadius: 8 }}>
                {errorMsg}
              </div>
            )}

            {imageBase64 && (
              <>
                <button style={BTN_PRIMARY} onClick={handleRunOCR}>
                  Read with AI →
                </button>
                <button style={BTN_GHOST} onClick={() => { setImageBase64(null); setImagePreview(null); setFileName(''); }}>
                  {isMobile ? 'Retake / choose another' : 'Choose a different file'}
                </button>
              </>
            )}
          </>
        )}

        {/* ── OCR RUNNING ───────────────────────────────────────── */}
        {step === 'ocr_running' && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#27500A' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Reading receipt…</div>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>AI is extracting fields</div>
          </div>
        )}

        {/* ── CONFIRM ───────────────────────────────────────────── */}
        {step === 'confirm' && ocrResult && (
          <>
            {/* OCR quality signal — Surface Honesty */}
            {ocrResult.parseError ? (
              <div style={{ ...OCR_BOX, background: '#fff7ed', borderColor: '#fed7aa', color: '#92400e' }}>
                ⚠️ OCR couldn't parse cleanly — enter fields manually below.
              </div>
            ) : (
              <div style={OCR_BOX}>
                ✓ AI read the receipt — review and edit before saving
                {ocrResult.ocr_cost_estimate != null && (
                  <span style={{ float: 'right', color: '#0284c7', fontSize: '0.75rem' }}>
                    ~${ocrResult.ocr_cost_estimate.toFixed(4)}{ocrResult.provider === 'claude' ? ' (fallback)' : ''}
                  </span>
                )}
              </div>
            )}

            {imagePreview && <img src={imagePreview} alt="Receipt" style={{ ...PREVIEW_IMG, maxHeight: 140 }} />}

            <div style={FIELD_ROW}>
              <label style={LABEL}>Vendor / Store</label>
              <input
                style={INPUT}
                value={fields.vendor}
                onChange={e => { setFields(f => ({ ...f, vendor: e.target.value })); setVendorChoice(null); }}
                placeholder="e.g. RaceTrac, Home Depot"
              />

              {/* THE UNIT QUESTION — asked here, beside the field it is about, and asked ONCE.
                  Answering "same as" records an alias, so the next document carrying this spelling
                  resolves silently. Declining creates a separate vendor. Leaving it alone saves the
                  receipt with no vendor bound — an identity question never costs you a document
                  (§6 r6 applied to identity; the rule lives in planVendorWrite where a probe
                  reaches it, not in this file). */}
              {vendorResolution.outcome === 'NEED_CONFIRMATION' && vendorResolution.disposition && (
                <div style={{
                  marginTop: 8, padding: '10px 12px', borderRadius: 8,
                  background: '#f7faf2', border: '1px solid #cfe0b8',
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#1f2937', lineHeight: 1.45 }}>
                    {vendorResolution.disposition.question}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {vendorResolution.disposition.candidates.map(c => (
                      <button
                        key={c.vendorId}
                        type="button"
                        onClick={() => setVendorChoice({ kind: 'same-as', vendorId: c.vendorId })}
                        style={{
                          minHeight: 44, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
                          fontSize: '0.8125rem', fontWeight: 700,
                          border: '1px solid #27500A',
                          background: vendorChoice && vendorChoice.kind === 'same-as' && vendorChoice.vendorId === c.vendorId ? '#27500A' : '#fff',
                          color: vendorChoice && vendorChoice.kind === 'same-as' && vendorChoice.vendorId === c.vendorId ? '#fff' : '#27500A',
                        }}
                      >Same as {c.name}</button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVendorChoice({ kind: 'new' })}
                      style={{
                        minHeight: 44, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
                        fontSize: '0.8125rem', fontWeight: 700,
                        border: '1px solid #27500A',
                        background: vendorChoice?.kind === 'new' ? '#27500A' : '#fff',
                        color: vendorChoice?.kind === 'new' ? '#fff' : '#27500A',
                      }}
                    >A different vendor</button>
                  </div>
                  {/* The candidate's REASON is shown, not just its name — "shares the email domain"
                      and "one name is the start of the other" are different strengths of evidence
                      and the owner is the one judging them. */}
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 8 }}>
                    {vendorResolution.disposition.candidates.map(c => `${c.name} — ${c.why}`).join(' · ')}
                  </div>
                  {vendorChoice === null && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 6 }}>
                      You can leave this unanswered — the receipt still saves, with no vendor linked.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={FIELD_ROW}>
              <label style={LABEL}>Date</label>
              <input
                style={INPUT}
                type="date"
                value={fields.date}
                onChange={e => setFields(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* ── INVOICE / DOCUMENT NUMBER (2026-09-04, David's ruling) ──────────────────────
                It was captured correctly and never shown. Vendor, date, total and every line
                were reviewable before saving; the one field the DEDUP KEY will be built on was
                not — and a vendor whose invoices the reader cannot read would have had no key
                at all, silently.

                🔴 IT IS ALSO THE TYPED FALLBACK, AND THE TWO CASES STAY DISTINGUISHABLE. The
                verdict comes from `describeDocumentNumber` (shared, pure, probe-reachable), which
                compares what will be stored against `receipt_number_original` — what the reader
                actually read, banked once. A number the owner typed is announced as hers on this
                screen and recorded as hers in the row, so nobody downstream mistakes it for
                something printed on the paper. */}
            <div style={FIELD_ROW}>
              <label style={LABEL}>Invoice / receipt number</label>
              <input
                style={INPUT}
                value={receiptNumber ?? ''}
                onChange={e => setReceiptNumber(e.target.value.trim() === '' ? null : e.target.value)}
                placeholder="Not printed on this document"
                inputMode="text"
                autoCapitalize="characters"
              />
              {(() => {
                const v = describeDocumentNumber(receiptNumberOriginal, receiptNumber);
                if (!v.notice) return null;
                return (
                  <div style={{
                    marginTop: 6, fontSize: '0.75rem', lineHeight: 1.45,
                    color: v.isHumanSupplied ? '#92400e' : '#6b7280',
                    background: v.isHumanSupplied ? '#fffbeb' : '#f9fafb',
                    border: `1px solid ${v.isHumanSupplied ? '#fde68a' : '#e5e7eb'}`,
                    borderRadius: 6, padding: '6px 10px',
                  }}>{v.notice}</div>
                );
              })()}
            </div>

            {/* ── LINE ITEMS GRID (between Date and Total Amount) ── */}
            <LineItemGrid
              lineItems={lineItems}
              onUpdate={updateLineItem}
              onDelete={deleteLineItem}
              onAdd={addLineItem}
              reconcileState={reconcileState}
              labelStyle={LABEL}
            />

            {/* Total Amount — AFTER line items grid so owner reconciles consciously */}
            <div style={FIELD_ROW}>
              <label style={LABEL}>Total Amount ($)</label>
              <input
                style={INPUT}
                type="number"
                step="0.01"
                min="0"
                value={fields.amount}
                onChange={e => setFields(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div style={FIELD_ROW}>
              <label style={LABEL}>Category</label>
              <select
                style={SELECT}
                value={fields.category}
                onChange={e => setFields(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">— select —</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* ── INFER-THEN-CONFIRM ROUTER (Wave 2) ────────────────────────── */}
            <div style={ROUTER_PANEL}>
              <div style={{ fontWeight: 700, color: '#27500A', marginBottom: 2 }}>
                {docType === 'invoice-customer'
                  ? '🧾 This looks like an invoice for a customer'
                  : '🧾 This looks like a receipt / expense'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 8 }}>
                What should we do with it? You can change these.
              </div>

              {/* Functional destination — create / update the customer */}
              <label style={DEST_ROW}>
                <input
                  type="checkbox"
                  checked={addCustomer}
                  style={{ marginTop: 3, width: 18, height: 18 }}
                  onChange={e => {
                    const on = e.target.checked;
                    setAddCustomer(on);
                    // Unchecking the customer also drops the delivery — a delivery needs a customer.
                    if (!on) setScheduleDelivery(false);
                    if (TRACE_ROUTER) console.log('[TRACE:ROUTER] toggle addCustomer:', on);
                  }}
                />
                <span><b>Add customer</b><br /><span style={DEST_SUB}>Create or update the customer from this invoice</span></span>
              </label>

              {/* Functional destination — schedule a dated, addressed delivery (loop close) */}
              <label style={DEST_ROW}>
                <input
                  type="checkbox"
                  checked={scheduleDelivery}
                  style={{ marginTop: 3, width: 18, height: 18 }}
                  onChange={e => {
                    const on = e.target.checked;
                    setScheduleDelivery(on);
                    // A delivery links to a customer — turning this on turns Add customer on too.
                    if (on) setAddCustomer(true);
                    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] toggle scheduleDelivery:', on);
                  }}
                />
                <span><b>Schedule delivery</b><br /><span style={DEST_SUB}>Use the delivery date &amp; ship-to address on this invoice</span></span>
              </label>

              {/* Shown-but-coming destination — not functional this build */}
              <div style={{ ...DEST_ROW, cursor: 'default', opacity: 0.6 }}>
                <input type="checkbox" disabled style={{ marginTop: 3, width: 18, height: 18 }} />
                <span><b>Analyze sale</b><span style={COMING}>coming</span><br /><span style={DEST_SUB}>Feed this into sales / leakage insights</span></span>
              </div>
            </div>

            {/* ── CUSTOMER & DELIVERY — validate before write (D-9) ──────────── */}
            {addCustomer && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ ...LABEL, fontWeight: 700, color: '#27500A', marginBottom: 8 }}>
                  Customer &amp; delivery — review before saving
                </div>

                <div style={FIELD_ROW}>
                  <label style={LABEL}>Customer name</label>
                  <input style={INPUT} value={invoice.customerName}
                    onChange={e => setInvoice(p => ({ ...p, customerName: e.target.value }))}
                    placeholder="Name on the invoice" />
                </div>

                <div style={TRIPLE_ROW}>
                  <div style={{ ...FIELD_ROW, flex: 1 }}>
                    <label style={LABEL}>Phone</label>
                    <input style={INPUT} value={invoice.customerPhone}
                      onChange={e => setInvoice(p => ({ ...p, customerPhone: e.target.value }))} placeholder="(optional)" />
                  </div>
                  <div style={{ ...FIELD_ROW, flex: 1 }}>
                    <label style={LABEL}>Email</label>
                    <input style={INPUT} value={invoice.customerEmail}
                      onChange={e => setInvoice(p => ({ ...p, customerEmail: e.target.value }))} placeholder="(optional)" />
                  </div>
                </div>

                <div style={FIELD_ROW}>
                  <label style={LABEL}>Bill-to address</label>
                  <input style={{ ...INPUT, marginBottom: 6 }} value={invoice.billLine1}
                    onChange={e => setInvoice(p => ({ ...p, billLine1: e.target.value }))} placeholder="Street" />
                  <div style={TRIPLE_ROW}>
                    <input style={{ ...INPUT, flex: 2 }} value={invoice.billCity}
                      onChange={e => setInvoice(p => ({ ...p, billCity: e.target.value }))} placeholder="City" />
                    <input style={{ ...INPUT, flex: 1 }} value={invoice.billState}
                      onChange={e => setInvoice(p => ({ ...p, billState: e.target.value }))} placeholder="State" />
                    <input style={{ ...INPUT, flex: 1 }} value={invoice.billZip}
                      onChange={e => setInvoice(p => ({ ...p, billZip: e.target.value }))} placeholder="ZIP" />
                  </div>
                </div>

                <div style={FIELD_ROW}>
                  <label style={LABEL}>Ship-to / delivery address</label>
                  <input style={{ ...INPUT, marginBottom: 6 }} value={invoice.shipLine1}
                    onChange={e => setInvoice(p => ({ ...p, shipLine1: e.target.value }))} placeholder="Street (if different)" />
                  <div style={TRIPLE_ROW}>
                    <input style={{ ...INPUT, flex: 2 }} value={invoice.shipCity}
                      onChange={e => setInvoice(p => ({ ...p, shipCity: e.target.value }))} placeholder="City" />
                    <input style={{ ...INPUT, flex: 1 }} value={invoice.shipState}
                      onChange={e => setInvoice(p => ({ ...p, shipState: e.target.value }))} placeholder="State" />
                    <input style={{ ...INPUT, flex: 1 }} value={invoice.shipZip}
                      onChange={e => setInvoice(p => ({ ...p, shipZip: e.target.value }))} placeholder="ZIP" />
                  </div>
                </div>

                <div style={TRIPLE_ROW}>
                  <div style={{ ...FIELD_ROW, flex: 1 }}>
                    <label style={LABEL}>Due date</label>
                    <input style={INPUT} type="date" value={invoice.dueDate}
                      onChange={e => setInvoice(p => ({ ...p, dueDate: e.target.value }))} />
                  </div>
                  <div style={{ ...FIELD_ROW, flex: 1 }}>
                    <label style={LABEL}>Delivery date</label>
                    <input style={INPUT} type="date" value={invoice.deliveryDate}
                      onChange={e => setInvoice(p => ({ ...p, deliveryDate: e.target.value }))} />
                  </div>
                </div>

                {/* Service type — inferred from line items (INSTALL/WARRANTY → planting), correctable */}
                {scheduleDelivery && (
                  <div style={FIELD_ROW}>
                    <label style={LABEL}>Service type</label>
                    <select style={SELECT} value={serviceType}
                      onChange={e => {
                        const v = e.target.value as ServiceType;
                        setServiceType(v);
                        if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] serviceType set:', v);
                      }}>
                      <option value="delivery_only">{SERVICE_TYPE_LABEL.delivery_only}</option>
                      <option value="planting">{SERVICE_TYPE_LABEL.planting}</option>
                    </select>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: 3 }}>
                      Inferred from the invoice lines — change if it's wrong.
                    </div>
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div style={{ color: '#A32D2D', fontSize: '0.875rem', margin: '0 0 12px', padding: '10px 12px', background: '#fef2f2', borderRadius: 8 }}>
                {errorMsg}
              </div>
            )}

            <button style={BTN_PRIMARY} onClick={handleConfirm}>
              {scheduleDelivery ? 'Save, add customer & schedule delivery ✓'
                : addCustomer   ? 'Save & add customer ✓'
                : 'Save ✓'}
            </button>
            <button style={BTN_GHOST} onClick={handleReset}>
              Start over
            </button>
          </>
        )}

        {/* ── SAVING ────────────────────────────────────────────── */}
        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#27500A' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>💾</div>
            <div style={{ fontWeight: 700 }}>Saving…</div>
          </div>
        )}

        {/* ── DONE ──────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={DONE_BOX}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#27500A', marginBottom: 6 }}>
              Saved
            </div>
            {customerResult && (
              <div style={{ fontSize: '0.875rem', color: '#27500A', marginBottom: 8 }}>
                👤 {customerResult.created
                  ? 'Customer added'
                  : scheduleDelivery
                    ? `Adding a delivery for existing ${invoice.customerName.trim() || 'customer'}`
                    : `Existing ${invoice.customerName.trim() || 'customer'} updated`}
              </div>
            )}
            {customerWarn && (
              <div style={{ fontSize: '0.8125rem', color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                {customerWarn}
              </div>
            )}
            {deliveryResult && (
              <div style={{ fontSize: '0.875rem', color: '#27500A', marginBottom: 8 }}>
                🚚 Delivery scheduled{invoice.deliveryDate ? ` for ${invoice.deliveryDate}` : ''}
              </div>
            )}
            {deliveryWarn && (
              <div style={{ fontSize: '0.8125rem', color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                {deliveryWarn}
              </div>
            )}
            {deliveryResult && (
              <button style={{ ...BTN_GHOST, marginBottom: 8 }} onClick={() => navigate('/delivery-schedule')}>
                View scheduled deliveries →
              </button>
            )}
            {/* 🔴 D-9: the number was READ and NOT STORED, and the owner is told so rather than
                left to discover it. Appears only in the window before 20260903c is applied. */}
            {receiptNumberDropped && (
              <div style={{ fontSize: '0.8125rem', color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                The receipt was saved, but its invoice number{receiptNumber ? ` (${receiptNumber})` : ''} could not be
                stored — that column is not live on this database yet. Everything else was kept. The number is still
                on the photo, and it will be captured normally once the update is applied.
              </div>
            )}
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 24 }}>
              {savedReceiptId && <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{savedReceiptId.slice(0, 8)}…</span>}
            </div>
            <button style={{ ...BTN_PRIMARY, marginTop: 0 }} onClick={handleReset}>
              Capture another
            </button>
          </div>
        )}

        {/* ── ERROR (unrecoverable) ─────────────────────────────── */}
        {step === 'error' && (
          <div>
            <div style={{ color: '#A32D2D', fontSize: '0.9375rem', padding: '12px', background: '#fef2f2', borderRadius: 8, marginBottom: 16 }}>
              {errorMsg ?? 'Something went wrong'}
            </div>
            <button style={BTN_PRIMARY} onClick={handleReset}>
              Try again
            </button>
          </div>
        )}
      </div>

      {/* ── CONFLICT DIALOG (outside card — fixed overlay, bottom sheet) ───── */}
      {showConflictDialog && reconcileState && (
        <ConflictDialog
          reconcileState={reconcileState}
          onClose={() => setShowConflictDialog(false)}
          onSaveAnyway={handleSaveAnyway}
          btnPrimaryStyle={BTN_PRIMARY}
          btnGhostStyle={BTN_GHOST}
        />
      )}
    </div>
  );
}
