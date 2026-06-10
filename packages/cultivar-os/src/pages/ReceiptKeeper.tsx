import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';

const TRACE_RECEIPT = true; // [TRACE:RECEIPT] STD-003 — comment out when David says "proven"

// STD-010: allowed types + size — must mirror the server-side constants in ocr.ts
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const CATEGORIES = ['fuel', 'supplies', 'meals', 'parts', 'equipment', 'maintenance', 'office', 'other'];

// Image compression before OCR: reduce payload to avoid Vercel body limits + speed up Gemini.
// A 3.4MB JPEG → ~4.5MB base64 JSON body, which hits Vercel Hobby's 10s function timeout.
// After compression: ~300KB JPEG → ~400KB body → Gemini responds in 2-4s.
const COMPRESS_TYPES     = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const COMPRESS_THRESHOLD = 400 * 1024; // only compress if original > 400 KB
const COMPRESS_MAX_DIM   = 1200;        // max pixel dimension after resize
const COMPRESS_QUALITY   = 0.82;        // JPEG re-encode quality — sufficient for receipt OCR

// Returns a base64 string (no data: prefix). If image is small or non-compressible, returns raw base64.
async function resizeAndCompressImage(file: File): Promise<{ base64: string; sizeBytes: number; mimeType: string }> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (!COMPRESS_TYPES.has(file.type) || file.size <= COMPRESS_THRESHOLD) {
    return { base64: raw, sizeBytes: file.size, mimeType: file.type || 'image/jpeg' };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const maxDim = COMPRESS_MAX_DIM;
      let w = width, h = height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else       { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) { resolve({ base64: raw, sizeBytes: file.size, mimeType: file.type }); return; }
        const reader2 = new FileReader();
        reader2.onload = () => {
          const b64 = (reader2.result as string).split(',')[1];
          resolve({ base64: b64, sizeBytes: blob.size, mimeType: 'image/jpeg' });
        };
        reader2.onerror = () => resolve({ base64: raw, sizeBytes: file.size, mimeType: file.type });
        reader2.readAsDataURL(blob);
      }, 'image/jpeg', COMPRESS_QUALITY);
    };
    img.onerror = () => resolve({ base64: raw, sizeBytes: file.size, mimeType: file.type });
    img.src = 'data:' + file.type + ';base64,' + raw;
  });
}

type Step = 'idle' | 'uploading' | 'ocr_running' | 'confirm' | 'saving' | 'done' | 'error';

interface OcrResult {
  parsed: {
    vendor?: string | null;
    date?: string | null;
    amount?: number | null;
    category?: string | null;
    line_items?: Array<{ description: string; amount: number }> | null;
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

  const [step, setStep]               = useState<Step>('idle');
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType]       = useState<string | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [fileName, setFileName]       = useState<string>('');
  const [ocrResult, setOcrResult]     = useState<OcrResult | null>(null);
  const [fields, setFields]           = useState<EditableFields>({ vendor: '', date: '', amount: '', category: '' });
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(null);

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

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime;base64, prefix — server gets raw base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(file: File) {
    const err = validateFile(file);
    if (err) { setErrorMsg(err); return; }

    setErrorMsg(null);
    setFileName(file.name);

    // Preview (for images only — use original file for display)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null); // PDF — no preview
    }

    // Compress before encoding: shrinks 3MB JPEG → ~300KB, keeping OCR payload under Vercel limits
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

      // Server may return HTML (502 gateway) — guard against JSON.parse throw
      let data: any = {};
      try { data = await res.json(); } catch { /* non-JSON body (502 etc.) — data stays {} */ }

      if (!res.ok || !data.ok) {
        const msg = data.error ?? (res.status === 502 ? 'OCR timed out — try a smaller or clearer photo' : 'OCR failed — try again');
        setErrorMsg(msg);
        setStep('error');
        return;
      }

      if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] OCR result — vendor:', data.parsed?.vendor, 'amount:', data.parsed?.amount, 'tokens:', data.inputTokens, '+', data.outputTokens, 'cost:', data.ocr_cost_estimate);

      setOcrResult(data);

      // Pre-fill editable fields from OCR output
      setFields({
        vendor:   data.parsed?.vendor   ?? '',
        date:     data.parsed?.date     ?? '',
        amount:   data.parsed?.amount != null ? String(data.parsed.amount) : '',
        category: data.parsed?.category ?? '',
      });

      setStep('confirm');
    } catch (err: any) {
      console.error('[TRACE:RECEIPT] OCR fetch error:', err.message);
      setErrorMsg('Network error — check your connection');
      setStep('error');
    }
  }

  // KIND-1: accept_vs_edit — detect edits relative to OCR output at confirm moment
  function detectAcceptVsEdit(): 'accepted_as_is' | 'edited' {
    const p = ocrResult?.parsed;
    if (!p) return 'edited'; // no OCR output = manual entry = edited
    const vendorChanged  = fields.vendor.trim()   !== (p.vendor   ?? '').trim();
    const dateChanged    = fields.date.trim()      !== (p.date     ?? '').trim();
    const amountChanged  = fields.amount.trim()    !== (p.amount != null ? String(p.amount) : '');
    const categoryChanged = fields.category.trim() !== (p.category ?? '').trim();
    return (vendorChanged || dateChanged || amountChanged || categoryChanged) ? 'edited' : 'accepted_as_is';
  }

  async function handleConfirm() {
    if (!businessId || !ocrResult) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMsg('Not authenticated'); return; }

    const acceptVsEdit = detectAcceptVsEdit();
    setStep('saving');

    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] confirm — accept_vs_edit:', acceptVsEdit, 'vendor:', fields.vendor, 'amount:', fields.amount);

    // STD-010: per-tenant storage path — receipts/{business_id}/{receipt_id}
    // Upload image to Supabase Storage before writing the DB row
    const receiptId = crypto.randomUUID();
    let image_url: string | null = null;

    if (imageBase64 && mimeType) {
      try {
        const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
        const storagePath = `${businessId}/${receiptId}.${ext}`;

        // Convert base64 back to Blob for storage upload
        const binary = atob(imageBase64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });

        const { error: storErr } = await supabase.storage
          .from('receipts')
          .upload(storagePath, blob, { contentType: mimeType, upsert: false });

        if (storErr) {
          // Storage error is non-fatal — receipt row still saved without image_url
          console.error('[TRACE:RECEIPT] storage upload error:', storErr.message);
        } else {
          // Store the storage path (not a public URL) — bucket is private.
          // To display: generate a signed URL from this path at view time.
          image_url = storagePath;
          if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] stored image — path:', storagePath);
        }
      } catch (e: any) {
        console.error('[TRACE:RECEIPT] storage exception:', e.message);
        // non-fatal — continue to DB write
      }
    }

    const parsedAmount = parseFloat(fields.amount);

    const { data, error } = await supabase.from('receipts').insert({
      id:                receiptId,
      business_id:       businessId,
      uploaded_by:       user.id,
      image_url,
      ocr_raw:           ocrResult.ocr_raw,
      vendor:            fields.vendor.trim() || null,
      date:              fields.date.trim()   || null,
      amount:            isNaN(parsedAmount)  ? null : parsedAmount,
      category:          fields.category      || null,
      status:            'confirmed',
      accept_vs_edit:    acceptVsEdit,
      ocr_cost_estimate: ocrResult.ocr_cost_estimate ?? null,
    }).select('id').single();

    if (error) {
      console.error('[TRACE:RECEIPT] DB insert error:', error.message);
      setErrorMsg('Failed to save receipt — ' + error.message);
      setStep('error');
      return;
    }

    if (TRACE_RECEIPT) console.log('[TRACE:RECEIPT] saved — id:', data?.id, 'accept_vs_edit:', acceptVsEdit);
    setSavedReceiptId(data?.id ?? receiptId);
    setStep('done');
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
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={PAGE}>
      <div style={CARD}>
        <button style={BACK} onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>

        <h1 style={TITLE}>Receipt Keeper</h1>
        <p style={SUBTITLE}>Capture truck receipts — OCR reads, you confirm</p>

        {/* ── IDLE / FILE SELECT ─────────────────────────────────── */}
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
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Gemini Flash is extracting fields</div>
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
                    ~${ocrResult.ocr_cost_estimate.toFixed(4)}
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
    </div>
  );
}
