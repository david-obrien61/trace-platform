/**
 * FILE: modules/CSVImporter.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Standalone CSV import module for migrating customers from any external system.
 *          Used both inside the Onboarding Wizard and as a standalone OMNI tool.
 */

import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import ExternalBridge from '../ExternalBridge';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (60 classNames converted):
// (1) animate-spin on loading spinner → ign-spin CSS class
// (2) hover:border-blue-500 on drop zone → dropped (cosmetic; no inline hover equivalent)
// (3) hover:bg-blue-500 on Preview button → ign-btn-primary CSS class
// (4) active:scale-95 on action buttons → ign-card-hover CSS class
// (5) hover:bg-emerald-500 on Import button → ign-btn-emerald CSS class
// (6) hover:bg-slate-800 on Back/Another buttons → dropped (cosmetic)
// (7) hover:text-slate-300 on Collapse toggle → dropped (cosmetic)
// (8) disabled:bg-slate-800 disabled:text-slate-600 → inline conditional styles
// (9) grid grid-cols-2 on formats list + DONE stats → flex-wrap (no breakpoint equivalent)
// [TRACE:STYLE] CSVImporter converted, 60 classNames → inline, 9 non-1:1 categories

const FIELD_OPTIONS = [
  { value: '',        label: '— Ignore this column —' },
  { value: 'name',   label: 'Customer Name' },
  { value: 'phone',  label: 'Phone Number' },
  { value: 'email',  label: 'Email Address' },
  { value: 'address',label: 'Street Address' },
  { value: 'city',   label: 'City' },
  { value: 'state',  label: 'State' },
  { value: 'zip',    label: 'ZIP Code' },
  { value: 'year',   label: 'Vehicle Year' },
  { value: 'make',   label: 'Vehicle Make' },
  { value: 'model',  label: 'Vehicle Model' },
  { value: 'vin',    label: 'VIN' },
  { value: 'notes',  label: 'Notes / Comments' },
];

const backBtnStyle = {
  paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16,
  backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#94a3b8',
  borderRadius: 16, fontWeight: 900, fontSize: 10, textTransform: 'uppercase',
  cursor: 'pointer', transition: 'background-color 0.15s',
};

const CSVImporter = ({ onImportComplete }) => {
  const [phase, setPhase]           = useState('UPLOAD');
  const [parsed, setParsed]         = useState(null);
  const [mapping, setMapping]       = useState({});
  const [customers, setCustomers]   = useState([]);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const fileRef = useRef();

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] CSVImporter converted, 60 classNames → inline, 9 non-1:1 categories');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const data = await ExternalBridge.csv.parse(file);
      setParsed(data);
      setMapping(Object.fromEntries(
        Object.entries(data.mapping).filter(([, v]) => v !== null).map(([k, v]) => [v, k])
      ));
      setPhase('MAPPING');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const buildCustomers = () => {
    const reverseMapping = {};
    Object.entries(mapping).forEach(([col, field]) => { if (field) reverseMapping[field] = col; });
    return ExternalBridge.csv.mapToCustomers(parsed.rows, reverseMapping);
  };

  const goToPreview = () => {
    const built = buildCustomers();
    setCustomers(built);
    setPhase('PREVIEW');
  };

  const runImport = () => {
    const res = ExternalBridge.csv.importCustomers(customers);
    setResult(res);
    setPhase('DONE');
    if (onImportComplete) onImportComplete(res);
  };

  // ── UPLOAD ────────────────────────────────────────────────────────────────

  if (phase === 'UPLOAD') return (
    <div style={{ padding: 24, backgroundColor: '#020617', minHeight: '100vh', color: '#e2e8f0' }}>
      <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 4 }}>Import Customers</h2>
      <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 32 }}>Accepts any CSV from Excel, Google Sheets, Mitchell1, Tekmetric, or your old system</p>

      {/* hover:border-blue-500 → dropped (cosmetic; no inline hover equivalent) */}
      <div
        style={{
          border: '2px dashed #1e293b',
          borderRadius: 24,
          padding: 64,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          marginBottom: 24,
        }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
      >
        {/* animate-spin → ign-spin */}
        {loading ? (
          <div className="ign-spin" style={{ width: 40, height: 40, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: 16 }} />
        ) : (
          <Upload size={40} style={{ color: '#475569', marginBottom: 16 }} />
        )}
        <p style={{ fontSize: 14, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', fontStyle: 'italic', marginBottom: 8 }}>
          {loading ? 'Reading file...' : 'Drop your CSV here or click to browse'}
        </p>
        <p style={{ fontSize: 9, color: '#475569', maxWidth: 320 }}>
          Columns are auto-detected. You'll be able to confirm the mapping before anything is imported.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', backgroundColor: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.20)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <AlertCircle size={16} />
          <p style={{ fontSize: 12, fontWeight: 700 }}>{error}</p>
        </div>
      )}

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>Supported Formats</p>
        {/* grid grid-cols-2 → flex-wrap; flagged: no breakpoint equivalent */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Excel (.xlsx → Save as CSV)', 'Google Sheets export', 'Mitchell1 customer export', 'Tekmetric customer report', 'QuickBooks customer list CSV', 'Any custom spreadsheet'].map(f => (
            <div key={f} style={{ flex: '1 1 calc(50% - 4px)', minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>
              <CheckCircle size={10} style={{ color: '#10b981' }} /> {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── MAPPING ───────────────────────────────────────────────────────────────

  if (phase === 'MAPPING') return (
    <div style={{ padding: 24, backgroundColor: '#020617', minHeight: '100vh', color: '#e2e8f0' }}>
      <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 4 }}>Confirm Column Mapping</h2>
      <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        We auto-detected {Object.values(mapping).filter(Boolean).length} of {parsed.headers.length} columns.
        Adjust anything that looks wrong.
      </p>
      <p style={{ fontSize: 9, color: '#475569', marginBottom: 32 }}>{parsed.totalRows} data rows found in file</p>

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {parsed.headers.map(header => (
          <div key={header} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ backgroundColor: '#000000', border: '1px solid #1e293b', borderRadius: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{header}</p>
              <p style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {parsed.rows[0]?.[header] || '—'}
              </p>
            </div>
            <span style={{ color: '#334155', fontSize: 18, flexShrink: 0 }}>→</span>
            {/* focus:border-blue-500 → ign-input */}
            <select
              value={mapping[header] || ''}
              onChange={e => setMapping(m => ({ ...m, [header]: e.target.value || null }))}
              className="ign-input"
              style={{
                backgroundColor: '#000000', border: '1px solid #1e293b', borderRadius: 12,
                paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                fontSize: 10, color: '#ffffff', fontWeight: 700, textTransform: 'uppercase',
                outline: 'none', transition: 'border-color 0.15s', flex: 1, appearance: 'none', cursor: 'pointer',
              }}
            >
              {FIELD_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {/* hover:bg-slate-800 on Back → dropped (cosmetic) */}
        <button onClick={() => setPhase('UPLOAD')} style={backBtnStyle}>Back</button>
        {/* hover:bg-blue-500 → ign-btn-primary; active:scale-95 → ign-card-hover; disabled:* → inline conditional */}
        <button
          onClick={goToPreview}
          disabled={!Object.values(mapping).includes('name')}
          className={Object.values(mapping).includes('name') ? 'ign-btn-primary ign-card-hover' : ''}
          style={{
            flex: 1,
            backgroundColor: Object.values(mapping).includes('name') ? '#2563eb' : '#1e293b',
            color: Object.values(mapping).includes('name') ? '#ffffff' : '#475569',
            fontWeight: 900,
            paddingTop: 16,
            paddingBottom: 16,
            borderRadius: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: 10,
            transition: 'all 0.15s',
            border: 'none',
            cursor: Object.values(mapping).includes('name') ? 'pointer' : 'not-allowed',
          }}
        >
          Preview Import ({parsed.totalRows} rows)
        </button>
      </div>

      {!Object.values(mapping).includes('name') && (
        <p style={{ fontSize: 9, color: '#fb923c', marginTop: 12, textAlign: 'center' }}>At minimum, map a column to "Customer Name" to continue.</p>
      )}
    </div>
  );

  // ── PREVIEW ───────────────────────────────────────────────────────────────

  if (phase === 'PREVIEW') return (
    <div style={{ padding: 24, backgroundColor: '#020617', minHeight: '100vh', color: '#e2e8f0' }}>
      <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 4 }}>Preview</h2>
      <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>
        {customers.length} customers ready to import · Review before confirming
      </p>

      {/* hover:text-slate-300 on Collapse → dropped (cosmetic) */}
      <button
        onClick={() => setShowPreview(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
      >
        {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showPreview ? 'Collapse' : 'Expand'} Preview
      </button>

      {showPreview && (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {customers.slice(0, 20).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid #1e293b' }}>
                <div style={{ width: 32, height: 32, backgroundColor: '#1e293b', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#64748b', flexShrink: 0 }}>
                  {(i + 1)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                  <p style={{ fontSize: 9, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[c.phone, c.email, c.address].filter(Boolean).join(' · ')}</p>
                </div>
                {c.vehicles?.length > 0 && (
                  <span style={{ fontSize: 8, fontWeight: 900, color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.10)', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, flexShrink: 0 }}>
                    {c.vehicles[0].year} {c.vehicles[0].make}
                  </span>
                )}
              </div>
            ))}
            {customers.length > 20 && (
              <div style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>
                <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', fontWeight: 900 }}>+ {customers.length - 20} more</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {/* hover:bg-slate-800 → dropped (cosmetic) */}
        <button onClick={() => setPhase('MAPPING')} style={backBtnStyle}>Back</button>
        {/* hover:bg-emerald-500 → ign-btn-emerald; active:scale-95 → ign-card-hover */}
        <button
          onClick={runImport}
          className="ign-btn-emerald ign-card-hover"
          style={{
            flex: 1,
            backgroundColor: '#059669',
            color: '#ffffff',
            fontWeight: 900,
            paddingTop: 16,
            paddingBottom: 16,
            borderRadius: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: 10,
            transition: 'all 0.15s',
            boxShadow: '0 10px 15px -3px rgba(5,150,105,0.30)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Import {customers.length} Customers
        </button>
      </div>
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────────────────────

  if (phase === 'DONE') return (
    <div style={{ padding: 24, backgroundColor: '#020617', minHeight: '100vh', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ width: 96, height: 96, backgroundColor: 'rgba(5,150,105,0.10)', border: '1px solid rgba(16,185,129,0.20)', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
        <CheckCircle size={48} style={{ color: '#34d399' }} />
      </div>
      <h2 style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 8 }}>Import Complete</h2>
      {/* grid grid-cols-2 → flex-wrap; flagged: no breakpoint equivalent */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 32, width: '100%', maxWidth: 320 }}>
        <div style={{ flex: '1 1 calc(50% - 8px)', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 30, fontWeight: 900, color: '#34d399' }}>{result.imported}</p>
          <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Imported</p>
        </div>
        <div style={{ flex: '1 1 calc(50% - 8px)', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 30, fontWeight: 900, color: '#64748b' }}>{result.skipped}</p>
          <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Skipped (Dupe)</p>
        </div>
      </div>
      <p style={{ fontSize: 10, color: '#64748b', marginTop: 24 }}>Duplicates were matched by name + phone and skipped automatically.</p>
      {/* hover:bg-slate-800 → dropped (cosmetic) */}
      <button
        onClick={() => setPhase('UPLOAD')}
        style={{ marginTop: 32, paddingLeft: 32, paddingRight: 32, paddingTop: 16, paddingBottom: 16, backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#cbd5e1', borderRadius: 16, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', cursor: 'pointer', transition: 'background-color 0.15s' }}
      >
        Import Another File
      </button>
    </div>
  );

  return null;
};

export default CSVImporter;
