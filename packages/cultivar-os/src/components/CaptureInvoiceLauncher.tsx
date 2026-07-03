/**
 * PURPOSE      Second door into the EXISTING invoice OCR→infer→route pipeline (ReceiptKeeper,
 *              shape:'invoice'). A persistent launcher on the delivery/route surfaces so Lauren
 *              can capture an invoice from where she manages deliveries — without hunting for the
 *              Receipts tile. ONE pipeline, two doors (mirrors the asset-capture two-doors pattern).
 *              This changes only WHERE the flow is entered; it recreates no capture/OCR/routing.
 * DEPENDENCIES react-router navigate; the ReceiptKeeper page at /receipts (existing route, existing
 *              /api/receipts/ocr + /api/customers/create endpoints — ZERO new Vercel function).
 *              Owner-gating is the caller's responsibility (mirrors the "Edit customer" gating on
 *              the delivery surfaces) — this button assumes it is only rendered for owners.
 * OUTPUTS      A button that navigates to /receipts with { state:{ from:'route' } } so the new
 *              door is observable on the existing [TRACE:ROUTER] trail (entered-from:route).
 */
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

export function CaptureInvoiceLauncher() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/receipts', { state: { from: 'route' } })}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
        padding: '8px 13px', background: '#fff', color: '#27500A', border: 'none',
        borderRadius: 8, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <FileText size={15} /> Capture invoice
    </button>
  );
}
