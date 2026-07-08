// ============================================================
// ScanOrder — the multi-item scan-loop front door into the PROVEN order flow.
// PURPOSE:  the user story — scan QR → add / scan QR → pass / scan QR → add, N items into
//           ONE order, then hand off to the proven addons → customer → review → submit tail.
//           No URL-typing: the owner walks the lot and builds the cart by scanning.
// DEPENDENCIES: QrScanner (jsQR camera — reused from walk-and-count), resolveStockLine +
//           STOCK_LINE_COLUMNS (@trace/shared/inventory — the SAME ladder the proven purchase
//           path uses), synthesizePlant + anchorKey (../lib/stockLinePlant — ONE definition),
//           extractTag (../lib/scanTag), useCart.addLine (merge-by-anchor). business_inventory
//           has owner/member RLS → an authenticated owner/staff session (this route is gated).
// OUTPUTS:  builds useCart.items[] (each line an Item-2 anchor: stock_line_id + sell_price),
//           then routes to /checkout/addons. [TRACE:CART] on each scan-add / pass / miss.
// SCOPE:    cart-building loop ONLY. Pricing/anchoring/netting are unchanged downstream.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ScanLine, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { resolveStockLine, STOCK_LINE_COLUMNS } from '@trace/shared/inventory';
import type { StockLineRow } from '@trace/shared/inventory';
import { QrScanner } from '../components/inventory/QrScanner';
import { useCart } from '../hooks/useCart';
import { synthesizePlant, anchorKey } from '../lib/stockLinePlant';
import { extractTag } from '../lib/scanTag';
import { totalPlantCount } from '../lib/netting';
import type { Plant } from '../types/plant';

const TRACE_CART = true; // [TRACE:CART] STD-003 — on until OWNER-PROVEN

type Phase = 'scanning' | 'reviewing' | 'picker' | 'unknown';

interface SizeChoice { inventoryId: string; size: string; qty: number | null; row: StockLineRow }

export function ScanOrder() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();
  const { items, addLine, removeLine, clear } = useCart();

  const [phase, setPhase]           = useState<Phase>('scanning');
  const [resolved, setResolved]     = useState<Plant | null>(null);
  const [qty, setQty]               = useState(1);
  const [candidates, setCandidates] = useState<SizeChoice[]>([]);
  const [pickerName, setPickerName] = useState('');
  const [unknownTag, setUnknownTag] = useState('');

  const plantCount = totalPlantCount(items);

  async function handleScan(raw: string) {
    if (!businessId) return;
    const tag = extractTag(raw);
    const resolution = await resolveStockLine(supabase, businessId, tag, { columns: STOCK_LINE_COLUMNS });

    if (resolution.kind === 'resolved') {
      const plant = synthesizePlant(resolution.row, businessId, tag);
      if (TRACE_CART) console.log('[TRACE:CART] scan resolved —', resolution.via, plant.common_name, { anchor: anchorKey(plant), sellPrice: plant.business_inventory?.sell_price });
      openReview(plant);
      return;
    }

    if (resolution.kind === 'collision') {
      const choices: SizeChoice[] = resolution.candidates.map(row => ({
        inventoryId: row.id,
        size:        (row.size ?? '').trim(),
        qty:         row.qty ?? null,
        row,
      }));
      if (TRACE_CART) console.log('[TRACE:CART] scan size collision — picker:', choices.map(c => c.size).join(' / '));
      setPickerName(resolution.variety);
      setCandidates(choices);
      setPhase('picker');
      return;
    }

    // miss — surface, keep scanning.
    if (TRACE_CART) console.log('[TRACE:CART] scan miss — not recognized:', tag);
    setUnknownTag(tag);
    setPhase('unknown');
  }

  function openReview(plant: Plant) {
    setResolved(plant);
    setQty(1);
    setPhase('reviewing');
  }

  function pickSize(c: SizeChoice) {
    const plant = synthesizePlant(c.row, businessId, c.row.sku ?? c.row.name);
    setCandidates([]);
    setPickerName('');
    openReview(plant);
  }

  function addToOrder() {
    if (!resolved) return;
    addLine(resolved, qty);   // [TRACE:CART] scan-add fires in the store (merge-by-anchor)
    setResolved(null);
    setPhase('scanning');
  }

  function pass() {
    if (TRACE_CART) console.log('[TRACE:CART] scan pass — item skipped (not added)', { anchor: resolved ? anchorKey(resolved) : null });
    setResolved(null);
    setPhase('scanning');
  }

  function review() {
    if (items.length === 0) return;
    navigate('/checkout/addons');
  }

  function exit() {
    clear();
    navigate('/orders');
  }

  const sellPrice = resolved?.business_inventory?.sell_price ?? 0;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={exit} aria-label="Cancel order"><ArrowLeft size={22} color="#1a2e0a" /></button>
        <h1 style={S.title}>New order — scan items</h1>
        <div style={{ flex: 1 }} />
        {items.length > 0 && <span style={S.tally}>{items.length} item{items.length !== 1 ? 's' : ''} · {plantCount}</span>}
      </div>

      {/* Camera */}
      <div style={S.card}>
        <QrScanner active={phase === 'scanning'} onScan={raw => void handleScan(raw)} />
      </div>

      {/* Cart so far */}
      {items.length > 0 && (
        <div style={S.cartCard}>
          <p style={S.cartHead}>In this order</p>
          {items.map((l) => {
            const key = anchorKey(l.plant);
            return (
              <div key={key} style={S.cartRow}>
                <span style={S.cartLabel}>{l.plant.common_name ?? l.plant.species}{l.plant.current_container ? ` · ${l.plant.current_container}` : ''} × {l.quantity}</span>
                <span style={S.cartAmt}>${((l.plant.business_inventory?.sell_price ?? 0) * l.quantity).toFixed(2)}</span>
                <button onClick={() => removeLine(key)} aria-label="Remove" style={S.iconBtn}><X size={15} color="#9ca3af" /></button>
              </div>
            );
          })}
          <button style={S.reviewBtn} onClick={review}>Review order →</button>
        </div>
      )}

      {items.length === 0 && phase === 'scanning' && (
        <div style={S.hintCard}>
          <ScanLine size={34} color="#27500A" style={{ marginBottom: 10 }} />
          <p style={S.lead}>Scan a plant tag QR to add it. Scan the next, and the next — they all go on one order. Pass on anything you don't want.</p>
        </div>
      )}

      {/* REVIEW sheet — resolved item, Add or Pass */}
      {phase === 'reviewing' && resolved && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) pass(); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{resolved.common_name ?? resolved.species}{resolved.current_container ? ` · ${resolved.current_container}` : ''}</h2>
              <button style={S.iconBtn} onClick={pass} aria-label="Pass"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={sellPrice > 0 ? S.price : S.priceNone}>
              {sellPrice > 0 ? `$${sellPrice.toFixed(2)} each` : 'No price set — you can set it in Inventory before checkout'}
            </p>
            <div style={S.qtyRow}>
              <span style={S.qtyLabel}>Quantity</span>
              <div style={S.stepper}>
                <button style={S.stepBtn} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease"><Minus size={16} color="#374151" /></button>
                <span style={S.stepVal}>{qty}</span>
                <button style={S.stepBtn} onClick={() => setQty(q => q + 1)} aria-label="Increase"><Plus size={16} color="#374151" /></button>
              </div>
            </div>
            <button style={S.btnPrimary} onClick={addToOrder}>Add to order</button>
            <button style={S.btnGhost} onClick={pass}>Pass — scan the next</button>
          </div>
        </div>
      )}

      {/* SIZE-PICKER sheet */}
      {phase === 'picker' && candidates.length > 0 && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) { setCandidates([]); setPickerName(''); setPhase('scanning'); } }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{pickerName} — which size?</h2>
              <button style={S.iconBtn} onClick={() => { setCandidates([]); setPickerName(''); setPhase('scanning'); }} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={S.subtle}>This variety is stocked in more than one size. Pick the one you're looking at.</p>
            {candidates.map((c) => (
              <button key={c.inventoryId} style={S.pickBtn} onClick={() => pickSize(c)}>
                <span style={S.pickSize}>{c.size}</span>
                {c.qty != null && <span style={S.pickQty}>{c.qty} available</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* UNKNOWN sheet — not recognized, keep scanning */}
      {phase === 'unknown' && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setPhase('scanning'); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>Didn't recognize this</h2>
              <button style={S.iconBtn} onClick={() => setPhase('scanning')} aria-label="Close"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={S.subtle}>Scanned <code style={S.code}>{unknownTag}</code> — it didn't match a stock line. Check the tag, or keep scanning.</p>
            <button style={S.btnPrimary} onClick={() => setPhase('scanning')}>Keep scanning</button>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page:       { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  header:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 } as React.CSSProperties,
  backBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  title:      { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  tally:      { background: '#27500A', color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' } as React.CSSProperties,
  card:       { background: '#fff', borderRadius: 14, padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 } as React.CSSProperties,
  hintCard:   { background: '#fff', borderRadius: 14, padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
  lead:       { color: '#374151', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 } as React.CSSProperties,
  cartCard:   { background: '#fff', borderRadius: 14, padding: '1rem 1.1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
  cartHead:   { fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' } as React.CSSProperties,
  cartRow:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } as React.CSSProperties,
  cartLabel:  { flex: 1, minWidth: 0, fontSize: '0.9rem', color: '#374151' } as React.CSSProperties,
  cartAmt:    { fontWeight: 600, fontSize: '0.9rem', color: '#374151' } as React.CSSProperties,
  iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  reviewBtn:  { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: 8 } as React.CSSProperties,
  modal:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 } as React.CSSProperties,
  sheet:      { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 560 } as React.CSSProperties,
  sheetHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' } as React.CSSProperties,
  sheetTitle: { fontSize: '1.15rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  price:      { color: '#27500A', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem' } as React.CSSProperties,
  priceNone:  { color: '#A32D2D', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 1rem' } as React.CSSProperties,
  qtyRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 } as React.CSSProperties,
  qtyLabel:   { fontSize: '0.95rem', color: '#374151', fontWeight: 600 } as React.CSSProperties,
  stepper:    { display: 'flex', alignItems: 'center', gap: 4, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: 2 } as React.CSSProperties,
  stepBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  stepVal:    { minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', color: '#1f2937' } as React.CSSProperties,
  subtle:     { color: '#6b7280', fontSize: '0.88rem', margin: '0 0 1rem' } as React.CSSProperties,
  code:       { background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', fontSize: '0.82rem', color: '#374151' } as React.CSSProperties,
  btnPrimary: { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  btnGhost:   { width: '100%', minHeight: 44, background: 'none', color: '#6b7280', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer', marginTop: 10 } as React.CSSProperties,
  pickBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 52, background: '#fff', color: '#1a2e0a', border: '1.5px solid #27500A', borderRadius: 10, padding: '0 1rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginBottom: 10 } as React.CSSProperties,
  pickSize:   { fontSize: '1.05rem', fontWeight: 700, color: '#1a2e0a' } as React.CSSProperties,
  pickQty:    { fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' } as React.CSSProperties,
};
