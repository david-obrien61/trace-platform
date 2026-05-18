import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight, Clock, Wrench, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';

const STATUS_META = {
  intake:       { label: 'NEW',          color: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10'   },
  queued:       { label: 'QUEUED',       color: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10'   },
  in_eval:      { label: 'IN EVAL',      color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/10'    },
  eval_done:    { label: 'EVAL DONE',    color: 'text-blue-300',    border: 'border-blue-500/30',    bg: 'bg-blue-500/10'    },
  estimating:   { label: 'ESTIMATING',  color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/10'  },
  pending_auth: { label: 'PENDING AUTH', color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/10'  },
  authorized:   { label: 'AUTHORIZED',  color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  in_repair:    { label: 'IN REPAIR',   color: 'text-sky-400',     border: 'border-sky-500/30',     bg: 'bg-sky-500/10'     },
  supplement:   { label: 'SUPPLEMENT',  color: 'text-yellow-400',  border: 'border-yellow-500/30',  bg: 'bg-yellow-500/10'  },
  repair_done:  { label: 'QC READY',    color: 'text-teal-400',    border: 'border-teal-500/30',    bg: 'bg-teal-500/10'    },
  invoiced:     { label: 'INVOICED',    color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/10'  },
  closed:       { label: 'CLOSED',      color: 'text-slate-400',   border: 'border-slate-600',      bg: 'bg-slate-800/50'   },
};

const FILTERS = ['ALL', 'OPEN', 'IN PROGRESS', 'AWAITING AUTH', 'CLOSED'];

const FILTER_STATUSES = {
  'ALL':          null,
  'OPEN':         ['intake', 'queued'],
  'IN PROGRESS':  ['in_eval', 'eval_done', 'estimating', 'authorized', 'in_repair', 'supplement', 'repair_done'],
  'AWAITING AUTH':['pending_auth'],
  'CLOSED':       ['invoiced', 'closed'],
};

const elapsed = (ts) => {
  const ms = Date.now() - new Date(ts).getTime();
  const h  = Math.floor(ms / 3600000);
  const d  = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return 'Just now';
};

const statusMeta = (status) =>
  STATUS_META[(status || '').toLowerCase()] || {
    label: (status || 'UNKNOWN').toUpperCase(),
    color: 'text-slate-400',
    border: 'border-slate-700',
    bg: 'bg-slate-800',
  };

const IgnitionFlux = ({ onNavigate, onSelectJob, onEnterKiosk }) => {
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('ALL');
  const [error, setError]     = useState('');

  const fetchJobs = useCallback(async () => {
    const shopId = DataBridge.getShopId();
    if (!shopId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const { data, error: dbErr } = await supabase
      .from('jobs')
      .select('id, wo_number, status, customer, vehicle, customer_id, vehicle_id, created_at, updated_at')
      .eq('shop_id', shopId)
      .order('updated_at', { ascending: false });
    setLoading(false);
    if (dbErr) { setError('Failed to load repair orders.'); return; }
    setJobs(data || []);
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const navigateToJob = (job) => {
    onSelectJob(job);
    const s = (job.status || '').toLowerCase();
    if (['intake', 'queued', 'in_eval', 'eval_done'].includes(s))      onNavigate('EVAL');
    else if (['estimating', 'pending_auth'].includes(s))                onNavigate('ESTIMATES');
    else if (['authorized', 'in_repair', 'supplement', 'repair_done'].includes(s)) onEnterKiosk();
    else if (s === 'invoiced')                                          onNavigate('INVOICE');
    else                                                                onNavigate('EVAL');
  };

  const filterStatuses = FILTER_STATUSES[filter];
  const visible = filterStatuses
    ? jobs.filter(j => filterStatuses.includes((j.status || '').toLowerCase()))
    : jobs;

  const counts = {
    'OPEN':          jobs.filter(j => ['intake','queued'].includes((j.status||'').toLowerCase())).length,
    'IN PROGRESS':   jobs.filter(j => ['in_eval','eval_done','estimating','authorized','in_repair','supplement','repair_done'].includes((j.status||'').toLowerCase())).length,
    'AWAITING AUTH': jobs.filter(j => (j.status||'').toLowerCase() === 'pending_auth').length,
    'CLOSED':        jobs.filter(j => ['invoiced','closed'].includes((j.status||'').toLowerCase())).length,
  };

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen">
      <header className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">Ignition Flux</h2>
          <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">
            {loading ? 'Loading...' : `${jobs.length} Repair Order${jobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchJobs}
          className="bg-slate-800 p-2 rounded-lg border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all"
        >
          <RefreshCw size={16} className={`text-blue-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* SUMMARY TILES */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(['OPEN', 'IN PROGRESS', 'AWAITING AUTH', 'CLOSED']).map(k => (
          <button
            key={k}
            onClick={() => setFilter(filter === k ? 'ALL' : k)}
            className={`bg-slate-900 border rounded-xl p-3 text-center transition-all active:scale-95 ${filter === k ? 'border-blue-500/60' : 'border-slate-800 hover:border-slate-600'}`}
          >
            <p className="text-xl font-black text-white">{counts[k]}</p>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-tight mt-0.5">{k}</p>
          </button>
        ))}
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
              filter === f
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-red-400 text-xs font-bold">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-slate-500 text-[10px] uppercase tracking-widest font-black animate-pulse">
          Loading repair orders...
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl">
          <Wrench size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-black">
            No repair orders in this category
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map(job => {
            const meta     = statusMeta(job.status);
            const cust     = job.customer;
            const custName = cust?.name
              || (cust?.first_name ? `${cust.first_name} ${cust.last_name || ''}`.trim() : null)
              || 'Unknown Customer';
            const veh      = job.vehicle;
            const vehLabel = veh
              ? `${veh.year || ''} ${veh.make || ''} ${veh.model || ''}`.trim() || 'Unknown Vehicle'
              : 'Unknown Vehicle';
            const woLabel  = job.wo_number || job.id?.slice(0, 8).toUpperCase();

            return (
              <button
                key={job.id}
                onClick={() => navigateToJob(job)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 text-left hover:border-slate-600 active:scale-[0.99] transition-all"
              >
                <div className={`flex-shrink-0 px-2 py-1 rounded-lg border ${meta.bg} ${meta.border}`}>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white uppercase tracking-tighter truncate">{custName}</p>
                  <p className="text-[10px] text-slate-500 uppercase truncate">{vehLabel}</p>
                  <p className="text-[9px] font-mono text-slate-600 mt-0.5">WO# {woLabel}</p>
                </div>

                <div className="flex-shrink-0 flex items-center gap-3">
                  <div className="flex items-center gap-1 text-slate-600">
                    <Clock size={10} />
                    <span className="text-[9px] font-black uppercase">
                      {elapsed(job.updated_at || job.created_at)}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-slate-600" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IgnitionFlux;
