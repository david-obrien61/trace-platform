import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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
    line_items?: Array<{ description: string; amount: number; sku?: string | null; quantity?: number | null; unit_price?: number | null }> | null;
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
  customerPhone: string;
  customerEmail: string;
  billLine1: string; billCity: string; billState: string; billZip: string;
  shipLine1: string; shipCity: string; shipState: string; shipZip: string;
  dueDate: string;
  deliveryDate: string;
}
const EMPTY_INVOICE: InvoiceFields = {
  customerName: '', customerPhone: '', customerEmail: '',
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

  // Line items state — user-editable grid from OCR output
  const [lineItems, setLineItems]               = useState<LineItem[]>([]);
  const [lineItemsOriginal, setLineItemsOriginal] = useState<Array<{ description: string; amount: number }> | null>(null);
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
        headers: { 'Content-Type': 'application/json' },
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

      // Initialize editable line items from OCR
      const ocrLines: Array<{ description: string; amount: number }> = data.parsed?.line_items ?? [];
      const initialLineItems: LineItem[] = ocrLines.map(item => ({
        id:          crypto.randomUUID(),
        description: item.description ?? '',
        amount:      item.amount != null ? Number(item.amount).toFixed(2) : '',
      }));
      // Inject tax as a line item when OCR captured it and it's not already in the line items
      const parsedTax: number | null = data.parsed?.tax ?? null;
      const taxAlreadyInLines = ocrLines.some((l: any) => /tax/i.test(l.description ?? ''));
      if (parsedTax != null && !taxAlreadyInLines) {
        initialLineItems.push({ id: crypto.randomUUID(), description: 'Tax', amount: Number(parsedTax).toFixed(2) });
      }
      setLineItems(initialLineItems);
      setLineItemsOriginal(ocrLines.length > 0 ? ocrLines : null);
      setAmountOriginal(data.parsed?.amount ?? null);

      // ── Invoice fields + infer-then-confirm router (Wave 2) ──────────────
      const p = data.parsed ?? {};
      const inv: InvoiceFields = {
        customerName:  p.customer_name  ?? '',
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
    const finalLineItems = lineItems
      .filter(item => item.description.trim() || item.amount.trim())
      .map(item => ({ description: item.description.trim(), amount: parseFloat(item.amount) || 0 }));

    // Reconcile status mapping: only 'large_mismatch' becomes 'large_mismatch_overridden' in DB
    const dbReconcileStatus: string | null = rs.status === 'no_lines'
      ? null
      : opts.overriddenAt ? 'large_mismatch_overridden' : rs.status;

    const headerAmountEdited: boolean | null = amountOriginal !== null
      ? parseFloat(fields.amount) !== amountOriginal
      : null;

    const { data, error } = await supabase.from('receipts').insert({
      id:                      receiptId,
      business_id:             businessId,
      uploaded_by:             user.id,
      image_url,
      ocr_raw:                 ocrResult?.ocr_raw,
      vendor:                  fields.vendor.trim() || null,
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
    }).select('id').single();

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
      const nameParts = invoice.customerName.trim().split(/\s+/);
      const first_name = nameParts[0];
      const last_name  = nameParts.slice(1).join(' '); // '' when single-word name (customers.last_name is NOT NULL)
      const custBody: any = {
        businessId,
        source: 'ocr-invoice',
        customer: {
          first_name,
          last_name,
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
      if (TRACE_ROUTER) console.log('[TRACE:ROUTER] creating customer from invoice —', first_name, last_name ?? '', 'email:', custBody.customer.email ?? '(none)', 'withDelivery:', scheduleDelivery);
      if (scheduleDelivery && TRACE_DELIVERY) console.log('[TRACE:DELIVERY] scheduling in same call — date:', custBody.delivery.deliveryDate ?? '(none)', 'serviceType:', serviceType,
        'addr:', [custBody.delivery.address.line1, custBody.delivery.address.city, custBody.delivery.address.state, custBody.delivery.address.zip].filter(Boolean).join(', ') || '(none)');
      try {
        const cRes  = await fetch('/api/customers/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
                onChange={e => setFields(f => ({ ...f, vendor: e.target.value }))}
                placeholder="e.g. RaceTrac, Home Depot"
              />
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
                👤 Customer {customerResult.created ? 'added' : 'updated'}
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
