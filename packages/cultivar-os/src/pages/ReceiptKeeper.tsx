import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import {
  LineItem,
  ReconcileResult,
  computeReconcile,
} from '../utils/receiptReconciliation';
import { resizeAndCompressImage } from '../utils/imageCompression';
import { ConflictDialog } from '../components/ConflictDialog';
import { LineItemGrid } from '../components/LineItemGrid';

const TRACE_RECEIPT = true; // [TRACE:RECEIPT] STD-003 — comment out when David says "proven"

// STD-010: allowed types + size — must mirror the server-side constants in ocr.ts
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const CATEGORIES = ['fuel', 'supplies', 'meals', 'parts', 'equipment', 'maintenance', 'office', 'other'];

type Step = 'idle' | 'uploading' | 'ocr_running' | 'confirm' | 'saving' | 'done' | 'error';

interface OcrResult {
  provider: 'gemini' | 'claude';
  parsed: {
    vendor?: string | null;
    date?: string | null;
    amount?: number | null;
    subtotal?: number | null;
    tax?: number | null;
    category?: string | null;
    line_items?: Array<{ description: string; amount: number; quantity?: number | null; unit_price?: number | null }> | null;
    receipt_number?: string | null;
    payment_method?: string | null;
  } | null;
  ocr_raw: any;
  parseError: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  ocr_cost_estimate: number | null;
}

interface EditableFields {
  vendor: string;
  date: string;
  amount: string;
  category: string;
}

export function ReceiptKeeper() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] file selected — name:', file.name, 'original:', file.size, 'compressed:', sizeBytes, 'type:', mt);
  }

  async function handleRunOCR() {
    if (!imageBase64 || !mimeType || !businessId) return;

    setStep('ocr_running');
    setErrorMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMsg('Not authenticated'); setStep('error'); return; }

    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] sending to OCR — businessId:', businessId);

    try {
      const res = await fetch('/api/receipts/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, userId: user.id, imageBase64, mimeType, fileSizeBytes }),
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
        date:     data.parsed?.date     ?? '',
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

  const BACK: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#64748b',
    fontSize: '0.875rem',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    padding: '0 0 16px',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={PAGE}>
      <div style={CARD}>
        <button style={BACK} onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>

        <h1 style={TITLE}>Receipt Keeper</h1>
        <p style={SUBTITLE}>Capture truck receipts — OCR reads, you confirm</p>

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
                📷 Tap or drop receipt here
                <div style={{ fontSize: '0.75rem', color: '#78a55a', marginTop: 6, fontWeight: 400 }}>
                  JPEG · PNG · WEBP · HEIC · PDF · Max {MAX_MB}MB
                </div>
              </div>
            ) : (
              <>
                {imagePreview && <img src={imagePreview} alt="Receipt preview" style={PREVIEW_IMG} />}
                {!imagePreview && (
                  <div style={{ ...OCR_BOX, background: '#f9fafb', borderColor: '#e5e7eb', color: '#374151', marginBottom: 12 }}>
                    📄 {fileName} ready for OCR
                  </div>
                )}
              </>
            )}

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
                  Choose a different file
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

            {errorMsg && (
              <div style={{ color: '#A32D2D', fontSize: '0.875rem', margin: '0 0 12px', padding: '10px 12px', background: '#fef2f2', borderRadius: 8 }}>
                {errorMsg}
              </div>
            )}

            <button style={BTN_PRIMARY} onClick={handleConfirm}>
              Save Receipt ✓
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
              Receipt saved
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: 24 }}>
              {savedReceiptId && <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{savedReceiptId.slice(0, 8)}…</span>}
            </div>
            <button style={{ ...BTN_PRIMARY, marginTop: 0 }} onClick={handleReset}>
              Capture another
            </button>
            <button style={BTN_GHOST} onClick={() => navigate('/dashboard')}>
              Back to Dashboard
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
            <button style={BTN_GHOST} onClick={() => navigate('/dashboard')}>
              Back to Dashboard
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
