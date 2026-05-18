import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Clock, ToggleLeft, ToggleRight, X, Shield, Barcode } from 'lucide-react';
import DataBridge from '../DataBridge';
import { supabase } from '../supabase';

const PMI_BADGES = {
  OVERDUE:  { label: 'PMI OVERDUE',  classes: 'bg-red-500/10 border-red-500/30 text-red-400' },
  DUE_SOON: { label: 'PMI DUE SOON', classes: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  OK:       { label: 'PMI OK',       classes: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
};

const getPmiStatus = (tool) => {
  if (!tool.pmi_interval_days || !tool.last_pmi_at) return null;
  const daysSince = (Date.now() - new Date(tool.last_pmi_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > tool.pmi_interval_days) return 'OVERDUE';
  if (daysSince > tool.pmi_interval_days - 7) return 'DUE_SOON';
  return 'OK';
};

const EMPTY_FORM = { name: '', type: '', brand: '', model: '', serial: '', barcode_id: '', pmi_interval_days: '' };

const IgnitionTools = () => {
  const [tools, setTools] = useState([]);
  const [bypassLog, setBypassLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('registry');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const shopId = DataBridge.getShopId();
  const currentUser = DataBridge.load('current_user');
  const isAdmin = currentUser?.permissions?.includes('ADMIN');

  const [custodyEnabled, setCustodyEnabled] = useState(() =>
    (DataBridge.load('shop_policy') || {}).enable_bay_custody || false
  );

  const loadTools = async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('tools')
      .select('*')
      .eq('shop_id', shopId)
      .order('added_at', { ascending: false });
    if (err) setError(err.message);
    else setTools(data || []);
    setLoading(false);
  };

  const loadBypassLog = async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from('tool_signout_log')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_manager_bypass', true)
      .order('created_at', { ascending: false })
      .limit(50);
    setBypassLog(data || []);
  };

  useEffect(() => { loadTools(); }, []);

  useEffect(() => {
    if (custodyEnabled && view === 'log') loadBypassLog();
  }, [custodyEnabled, view]);

  const toggleCustody = () => {
    const next = !custodyEnabled;
    DataBridge.save('shop_policy', { ...(DataBridge.load('shop_policy') || {}), enable_bay_custody: next });
    setCustodyEnabled(next);
  };

  const handleAddTool = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('tools').insert({
      shop_id: shopId,
      name: addForm.name.trim(),
      type: addForm.type.trim() || null,
      brand: addForm.brand.trim() || null,
      model: addForm.model.trim() || null,
      serial: addForm.serial.trim() || null,
      barcode_id: addForm.barcode_id.trim() || null,
      pmi_interval_days: addForm.pmi_interval_days ? parseInt(addForm.pmi_interval_days) : null,
      status: 'ACTIVE',
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setAddForm(EMPTY_FORM);
    setShowAddForm(false);
    loadTools();
  };

  return (
    <div className="p-6 pb-32 bg-slate-950 min-h-screen">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Hardware Ledger</h1>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Tool Registry & PMI Tracking</p>
        </div>
        {isAdmin && (
          <button
            onClick={toggleCustody}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              custodyEnabled
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                : 'border-slate-700 bg-slate-900 text-slate-500'
            }`}
          >
            {custodyEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            Bay Custody {custodyEnabled ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {custodyEnabled && (
        <div className="mb-4 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">
            Bay custody active — techs must acknowledge all tools at job closeout
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('registry')}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
            view === 'registry' ? 'bg-white text-black border-white' : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          Registry
        </button>
        {custodyEnabled && (
          <button
            onClick={() => setView('log')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              view === 'log' ? 'bg-white text-black border-white' : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            Bypass Log
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mb-4 font-bold">{error}</p>}

      {view === 'registry' && (
        <>
          {loading ? (
            <div className="text-slate-500 text-xs font-black uppercase tracking-widest text-center py-16">Loading...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {tools.length === 0 && !showAddForm && (
                <div className="text-center py-16 text-slate-600">
                  <Wrench size={40} className="mx-auto mb-4 opacity-30" />
                  <p className="text-xs font-black uppercase tracking-widest">No tools registered</p>
                </div>
              )}
              {tools.map(tool => {
                const pmiStatus = getPmiStatus(tool);
                const pmiBadge = pmiStatus ? PMI_BADGES[pmiStatus] : null;
                return (
                  <div key={tool.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-black text-sm">{tool.name}</p>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                          tool.status === 'ACTIVE'
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                            : tool.status === 'OVERDUE'
                            ? 'border-red-500/30 text-red-400 bg-red-500/10'
                            : 'border-slate-700 text-slate-500 bg-slate-800'
                        }`}>{tool.status}</span>
                        {pmiBadge && (
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${pmiBadge.classes}`}>
                            {pmiBadge.label}
                          </span>
                        )}
                      </div>
                      {(tool.brand || tool.model || tool.serial) && (
                        <p className="text-slate-500 text-xs">{[tool.brand, tool.model, tool.serial].filter(Boolean).join(' · ')}</p>
                      )}
                      {tool.barcode_id && (
                        <p className="text-slate-600 text-[10px] font-mono flex items-center gap-1">
                          <Barcode size={10} /> {tool.barcode_id}
                        </p>
                      )}
                      {tool.pmi_interval_days && (
                        <p className="text-slate-600 text-[10px] flex items-center gap-1">
                          <Clock size={10} /> PMI every {tool.pmi_interval_days} days
                          {tool.last_pmi_at && ` · Last: ${new Date(tool.last_pmi_at).toLocaleDateString()}`}
                        </p>
                      )}
                      {tool.last_assigned_tech && (
                        <p className="text-slate-600 text-[10px]">Last tech: {tool.last_assigned_tech}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showAddForm ? (
            <form onSubmit={handleAddTool} className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-widest text-white">Add Tool</h3>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <input
                required
                placeholder="Tool Name *"
                value={addForm.name}
                onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'type',       placeholder: 'Type (Scanner, Torque...)' },
                  { key: 'brand',      placeholder: 'Brand' },
                  { key: 'model',      placeholder: 'Model' },
                  { key: 'serial',     placeholder: 'Serial #' },
                  { key: 'barcode_id', placeholder: 'Barcode ID' },
                ].map(({ key, placeholder }) => (
                  <input
                    key={key}
                    placeholder={placeholder}
                    value={addForm[key]}
                    onChange={e => setAddForm(p => ({ ...p, [key]: e.target.value }))}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                ))}
                <input
                  type="number"
                  placeholder="PMI Interval (days)"
                  value={addForm.pmi_interval_days}
                  onChange={e => setAddForm(p => ({ ...p, pmi_interval_days: e.target.value }))}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Tool'}
              </button>
            </form>
          ) : (
            isAdmin && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-all"
              >
                <Plus size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Add Tool</span>
              </button>
            )
          )}
        </>
      )}

      {view === 'log' && (
        <div className="flex flex-col gap-3">
          {bypassLog.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <Shield size={40} className="mx-auto mb-4 opacity-30" />
              <p className="text-xs font-black uppercase tracking-widest">No manager bypasses on record</p>
            </div>
          ) : (
            bypassLog.map(entry => (
              <div key={entry.id} className="bg-slate-900 border border-amber-500/20 rounded-2xl p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-white font-black text-sm">{entry.tool_name}</p>
                    <p className="text-slate-500 text-xs">{entry.tech_name} · {new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    Manager Override
                  </span>
                </div>
                {entry.bypass_reason && (
                  <p className="text-slate-300 text-xs mt-2 bg-slate-800 rounded-xl px-3 py-2">{entry.bypass_reason}</p>
                )}
                {entry.bypass_by && (
                  <p className="text-slate-600 text-[10px] mt-2">Override by: {entry.bypass_by}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default IgnitionTools;
