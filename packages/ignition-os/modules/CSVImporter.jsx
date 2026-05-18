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

const CSVImporter = ({ onImportComplete }) => {
  const [phase, setPhase]           = useState('UPLOAD'); // UPLOAD | MAPPING | PREVIEW | DONE
  const [parsed, setParsed]         = useState(null);
  const [mapping, setMapping]       = useState({});
  const [customers, setCustomers]   = useState([]);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const fileRef = useRef();

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
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200">
      <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-1">Import Customers</h2>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-8">Accepts any CSV from Excel, Google Sheets, Mitchell1, Tekmetric, or your old system</p>

      <div
        className="border-2 border-dashed border-slate-800 hover:border-blue-500 rounded-3xl p-16 flex flex-col items-center text-center cursor-pointer transition-colors mb-6"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
      >
        {loading ? (
          <div className="animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full mb-4" />
        ) : (
          <Upload size={40} className="text-slate-600 mb-4" />
        )}
        <p className="text-sm font-black text-slate-400 uppercase italic mb-2">
          {loading ? 'Reading file...' : 'Drop your CSV here or click to browse'}
        </p>
        <p className="text-[9px] text-slate-600 max-w-xs">
          Columns are auto-detected. You'll be able to confirm the mapping before anything is imported.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => handleFile(e.target.files[0])} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl p-4">
          <AlertCircle size={16} />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-[10px] font-black text-slate-500 uppercase mb-3">Supported Formats</p>
        <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-500 font-mono">
          {['Excel (.xlsx → Save as CSV)', 'Google Sheets export', 'Mitchell1 customer export', 'Tekmetric customer report', 'QuickBooks customer list CSV', 'Any custom spreadsheet'].map(f => (
            <div key={f} className="flex items-center gap-2"><CheckCircle size={10} className="text-emerald-500" /> {f}</div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── MAPPING ───────────────────────────────────────────────────────────────

  if (phase === 'MAPPING') return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200">
      <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-1">Confirm Column Mapping</h2>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
        We auto-detected {Object.values(mapping).filter(Boolean).length} of {parsed.headers.length} columns.
        Adjust anything that looks wrong.
      </p>
      <p className="text-[9px] text-slate-600 mb-8">{parsed.totalRows} data rows found in file</p>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-6 space-y-3">
        {parsed.headers.map(header => (
          <div key={header} className="flex items-center gap-4">
            <div className="bg-black border border-slate-800 rounded-xl px-4 py-2 flex-1 min-w-0">
              <p className="text-[9px] text-slate-500 uppercase font-mono truncate">{header}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {parsed.rows[0]?.[header] || '—'}
              </p>
            </div>
            <span className="text-slate-700 text-lg flex-shrink-0">→</span>
            <select
              value={mapping[header] || ''}
              onChange={e => setMapping(m => ({ ...m, [header]: e.target.value || null }))}
              className="bg-black border border-slate-800 rounded-xl px-3 py-2 text-[10px] text-white font-bold uppercase focus:outline-none focus:border-blue-500 transition-colors flex-1 appearance-none cursor-pointer"
            >
              {FIELD_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={() => setPhase('UPLOAD')} className="px-6 py-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-800 transition-colors">
          Back
        </button>
        <button
          onClick={goToPreview}
          disabled={!Object.values(mapping).includes('name')}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors active:scale-95"
        >
          Preview Import ({parsed.totalRows} rows)
        </button>
      </div>

      {!Object.values(mapping).includes('name') && (
        <p className="text-[9px] text-orange-400 mt-3 text-center">At minimum, map a column to "Customer Name" to continue.</p>
      )}
    </div>
  );

  // ── PREVIEW ───────────────────────────────────────────────────────────────

  if (phase === 'PREVIEW') return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200">
      <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-1">Preview</h2>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-6">
        {customers.length} customers ready to import · Review before confirming
      </p>

      <button
        onClick={() => setShowPreview(v => !v)}
        className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 hover:text-slate-300 transition-colors"
      >
        {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showPreview ? 'Collapse' : 'Expand'} Preview
      </button>

      {showPreview && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl mb-6 overflow-hidden">
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
            {customers.slice(0, 20).map((c, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-500 flex-shrink-0">
                  {(i + 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white uppercase truncate">{c.name}</p>
                  <p className="text-[9px] text-slate-500 truncate">{[c.phone, c.email, c.address].filter(Boolean).join(' · ')}</p>
                </div>
                {c.vehicles?.length > 0 && (
                  <span className="text-[8px] font-black text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full flex-shrink-0">
                    {c.vehicles[0].year} {c.vehicles[0].make}
                  </span>
                )}
              </div>
            ))}
            {customers.length > 20 && (
              <div className="px-5 py-3 text-center">
                <p className="text-[9px] text-slate-600 uppercase font-black">+ {customers.length - 20} more</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setPhase('MAPPING')} className="px-6 py-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-800 transition-colors">
          Back
        </button>
        <button
          onClick={runImport}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-lg shadow-emerald-900/30 active:scale-95"
        >
          Import {customers.length} Customers
        </button>
      </div>
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────────────────────

  if (phase === 'DONE') return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200 flex flex-col items-center justify-center text-center">
      <div className="w-24 h-24 bg-emerald-600/10 border border-emerald-500/20 rounded-[2rem] flex items-center justify-center mb-8">
        <CheckCircle size={48} className="text-emerald-400" />
      </div>
      <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-2">Import Complete</h2>
      <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-3xl font-black text-emerald-400">{result.imported}</p>
          <p className="text-[9px] font-black text-slate-500 uppercase">Imported</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-3xl font-black text-slate-500">{result.skipped}</p>
          <p className="text-[9px] font-black text-slate-500 uppercase">Skipped (Dupe)</p>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-6">Duplicates were matched by name + phone and skipped automatically.</p>
      <button
        onClick={() => setPhase('UPLOAD')}
        className="mt-8 px-8 py-4 bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-800 transition-colors"
      >
        Import Another File
      </button>
    </div>
  );

  return null;
};

export default CSVImporter;
