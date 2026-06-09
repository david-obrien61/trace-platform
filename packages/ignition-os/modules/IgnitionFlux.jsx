import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight, Clock, Wrench, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = true;

// Non-1:1 mappings (31 classNames converted):
// (1) hover:bg-slate-700 on refresh button → ign-btn-secondary CSS class
// (2) animate-spin on RefreshCw icon → ign-spin CSS class
// (3) active:scale-95 / active:scale-[0.99] → ign-card-hover CSS class (0.98 approx)
// (4) hover:border-slate-600 on summary tiles → dropped (cosmetic)
// (5) hover:border-slate-600 + hover:text-white on filter tabs → dropped (cosmetic)
// (6) animate-pulse on loading text → ign-pulse CSS class
// (7) hover:border-slate-600 on job rows → ign-card-hover CSS class
// STATUS_META: Tailwind class strings → static CSS color/border/bg values (1:1 in behavior)
// grid-cols-4 → flex with flex:1 children (1:1 for fixed 4 items)
// [TRACE:STYLE] IgnitionFlux converted, 31 classNames → inline, 7 non-1:1 categories

// STATUS_META restructured: static CSS values instead of Tailwind class strings
const STATUS_META = {
  intake:       { label: 'NEW',          color: '#fbbf24', borderColor: 'rgba(245,158,11,0.30)',  backgroundColor: 'rgba(245,158,11,0.10)'  },
  queued:       { label: 'QUEUED',       color: '#fbbf24', borderColor: 'rgba(245,158,11,0.30)',  backgroundColor: 'rgba(245,158,11,0.10)'  },
  in_eval:      { label: 'IN EVAL',      color: '#60a5fa', borderColor: 'rgba(59,130,246,0.30)',  backgroundColor: 'rgba(59,130,246,0.10)'  },
  eval_done:    { label: 'EVAL DONE',    color: '#93c5fd', borderColor: 'rgba(59,130,246,0.30)',  backgroundColor: 'rgba(59,130,246,0.10)'  },
  estimating:   { label: 'ESTIMATING',  color: '#c084fc', borderColor: 'rgba(168,85,247,0.30)', backgroundColor: 'rgba(168,85,247,0.10)' },
  pending_auth: { label: 'PENDING AUTH', color: '#fb923c', borderColor: 'rgba(249,115,22,0.30)',  backgroundColor: 'rgba(249,115,22,0.10)'  },
  authorized:   { label: 'AUTHORIZED',  color: '#34d399', borderColor: 'rgba(16,185,129,0.30)', backgroundColor: 'rgba(16,185,129,0.10)' },
  in_repair:    { label: 'IN REPAIR',   color: '#38bdf8', borderColor: 'rgba(14,165,233,0.30)',  backgroundColor: 'rgba(14,165,233,0.10)'  },
  supplement:   { label: 'SUPPLEMENT',  color: '#facc15', borderColor: 'rgba(234,179,8,0.30)',   backgroundColor: 'rgba(234,179,8,0.10)'   },
  repair_done:  { label: 'QC READY',    color: '#2dd4bf', borderColor: 'rgba(20,184,166,0.30)',  backgroundColor: 'rgba(20,184,166,0.10)'  },
  invoiced:     { label: 'INVOICED',    color: '#fb923c', borderColor: 'rgba(249,115,22,0.30)',  backgroundColor: 'rgba(249,115,22,0.10)'  },
  closed:       { label: 'CLOSED',      color: '#94a3b8', borderColor: '#475569',               backgroundColor: 'rgba(30,41,59,0.50)'    },
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
    color: '#94a3b8',
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  };

const IgnitionFlux = ({ onNavigate, onSelectJob, onEnterKiosk }) => {
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('ALL');
  const [error, setError]     = useState('');

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionFlux converted, 31 classNames → inline, 7 non-1:1 categories');

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
    <div style={{ padding: 24, backgroundColor: '#020617', color: '#e2e8f0', minHeight: '100%' }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        borderBottom: '1px solid #1e293b',
        paddingBottom: 16,
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em', color: '#ffffff', textTransform: 'uppercase' }}>
            Ignition Flux
          </h2>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {loading ? 'Loading...' : `${jobs.length} Repair Order${jobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {/* hover:bg-slate-700 → ign-btn-secondary; active:scale-95 → ign-card-hover */}
        <button
          onClick={fetchJobs}
          className="ign-btn-secondary ign-card-hover"
          style={{
            backgroundColor: '#1e293b',
            padding: 8,
            borderRadius: 8,
            border: '1px solid #334155',
            cursor: 'pointer',
          }}
        >
          {/* animate-spin → ign-spin CSS class */}
          <RefreshCw size={16} className={loading ? 'ign-spin' : ''} style={{ color: '#3b82f6' }} />
        </button>
      </header>

      {/* SUMMARY TILES — grid-cols-4 → flex */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {(['OPEN', 'IN PROGRESS', 'AWAITING AUTH', 'CLOSED']).map(k => (
          <button
            key={k}
            onClick={() => setFilter(filter === k ? 'ALL' : k)}
            style={{
              flex: 1,
              backgroundColor: '#0f172a',
              border: `1px solid ${filter === k ? 'rgba(59,130,246,0.60)' : '#1e293b'}`,
              borderRadius: 12,
              padding: 12,
              textAlign: 'center',
              transition: 'border-color 0.15s',
              cursor: 'pointer',
            }}
          >
            <p style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>{counts[k]}</p>
            <p style={{ fontSize: 8, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.25, marginTop: 2 }}>{k}</p>
          </button>
        ))}
      </div>

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 12,
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              border: '1px solid',
              transition: 'all 0.15s',
              cursor: 'pointer',
              backgroundColor: filter === f ? '#2563eb' : '#0f172a',
              borderColor:     filter === f ? '#3b82f6' : '#1e293b',
              color:           filter === f ? '#ffffff' : '#64748b',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.30)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}>
          <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700 }}>{error}</p>
        </div>
      )}

      {/* animate-pulse → ign-pulse CSS class */}
      {loading && (
        <div className="ign-pulse" style={{
          textAlign: 'center',
          paddingTop: 64,
          paddingBottom: 64,
          color: '#64748b',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 900,
        }}>
          Loading repair orders...
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div style={{
          textAlign: 'center',
          paddingTop: 64,
          paddingBottom: 64,
          border: '1px dashed #1e293b',
          borderRadius: 16,
        }}>
          <Wrench size={32} style={{ color: '#334155', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 900 }}>
            No repair orders in this category
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              /* hover:border-slate-600 active:scale-[0.99] → ign-card-hover CSS class */
              <button
                key={job.id}
                onClick={() => navigateToJob(job)}
                className="ign-card-hover"
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  flexShrink: 0,
                  padding: '4px 8px',
                  borderRadius: 8,
                  border: `1px solid ${meta.borderColor}`,
                  backgroundColor: meta.backgroundColor,
                }}>
                  <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: meta.color }}>
                    {meta.label}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {custName}
                  </p>
                  <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {vehLabel}
                  </p>
                  <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#475569', marginTop: 2 }}>WO# {woLabel}</p>
                </div>

                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#475569' }}>
                    <Clock size={10} />
                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>
                      {elapsed(job.updated_at || job.created_at)}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: '#475569' }} />
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
