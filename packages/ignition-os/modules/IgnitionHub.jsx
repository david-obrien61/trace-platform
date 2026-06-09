/**
 * MODULE: HUB (Dispatch & Logistics)
 * VERSION: v1.1.0
 * DESC: Live map-based dispatching. Units derived from active jobs + tech profiles.
 *       Positions stored in DataBridge fleet_units; "Simulate GPS" seeds coords for demo.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Map, Navigation, Truck, AlertCircle, Radio, Clock, Lock, Package, MapPin } from 'lucide-react';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = false;

// Non-1:1 mappings (57 classNames converted):
// (1) animate-pulse on Radio icon + ghost marker → ign-pulse CSS class
// (2) group-hover:opacity-100 on marker tooltips → dropped (no inline group-hover; tooltips hidden)
// (3) hover:bg-blue-500 on Activate button → ign-btn-primary CSS class
// (4) hover:text-blue-400 hover:border-blue-400/50 on Locate button → dropped (cosmetic)
// (5) filter blur-2xl grayscale on map → combined as inline filter string
// [TRACE:STYLE] IgnitionHub converted, 57 classNames → inline, 5 non-1:1 categories

// Leander, TX center — used when shop_info has no coords
const DEFAULT_CENTER = { lat: 30.5788, lng: -97.8531 };

const SPREAD_LAT = 0.12;
const SPREAD_LNG = 0.16;

const toViewport = (lat, lng, center) => ({
  top:  `${50 - ((lat  - center.lat) / SPREAD_LAT)  * 50}%`,
  left: `${50 + ((lng  - center.lng) / SPREAD_LNG) * 50}%`,
});

const randomNearby = (center) => ({
  lat: center.lat + (Math.random() - 0.5) * 0.06,
  lng: center.lng + (Math.random() - 0.5) * 0.08,
});

// Returns style + pulse flag for fleet unit marker circle
const getStatusStyle = (status) => {
  if (status === 'CRITICAL')   return { backgroundColor: '#ef4444', borderColor: '#ffffff', boxShadow: '0 0 15px rgba(239,68,68,0.8)' };
  if (status === 'IN_TRANSIT') return { backgroundColor: '#2563eb', borderColor: '#ffffff', boxShadow: '0 0 15px rgba(37,99,235,0.5)' };
  if (status === 'IDLE')       return { backgroundColor: '#475569', borderColor: '#64748b', boxShadow: 'none' };
  return { backgroundColor: '#059669', borderColor: '#ffffff', boxShadow: '0 0 15px rgba(16,185,129,0.5)' };
};

// Returns style for status dot in unit list footer
const getDotStyle = (status) => {
  if (status === 'CRITICAL') return { backgroundColor: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,1)' };
  if (status === 'IDLE')     return { backgroundColor: '#475569' };
  return { backgroundColor: '#10b981' };
};

const IgnitionHub = ({ activeJob }) => {
  const { isExpired } = DataBridge.checkTrialStatus('HUB');
  const shopInfo  = DataBridge.load('shop_info') || {};
  const shopName  = shopInfo.name || 'Your Shop';
  const center    = DEFAULT_CENTER;

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionHub converted, 57 classNames → inline, 5 non-1:1 categories');

  const buildUnits = useCallback(() => {
    const jobs     = DataBridge.getJobs();
    const profiles = DataBridge.getProfiles();
    const stored   = DataBridge.getFleetUnits();
    const posMap   = Object.fromEntries(stored.map(u => [u.id, u]));

    const activeStatuses = new Set(['OPEN', 'IN_PROGRESS', 'IN_TRANSIT', 'DISPATCHED']);
    const jobUnits = jobs
      .filter(j => activeStatuses.has(j.status))
      .map(j => {
        const hasCritical = j.inventory?.specialized?.some(i => i.health === 'RED');
        const stored      = posMap[j.id] || {};
        return {
          id:     j.id,
          name:   `${j.unit || 'Unit'} — ${j.customerName || j.customer || 'Unknown'}`,
          status: hasCritical ? 'CRITICAL' : j.status === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'ON_JOB',
          lat:    stored.lat  ?? null,
          lng:    stored.lng  ?? null,
          eta:    j.status === 'IN_TRANSIT' ? (stored.eta || 'En Route') : 'At Shop',
          fault:  hasCritical ? 'PMI ALERT' : '',
          source: 'JOB',
        };
      });

    const jobIds = new Set(jobUnits.map(u => u.id));
    const techUnits = Object.values(profiles)
      .filter(p => p.role === 'TECH' || (p.permissions || []).includes('TECH'))
      .filter(p => !jobIds.has(p.id))
      .map(p => {
        const stored = posMap[`TECH-${p.id}`] || {};
        return {
          id:     `TECH-${p.id}`,
          name:   p.name,
          status: 'IDLE',
          lat:    stored.lat ?? null,
          lng:    stored.lng ?? null,
          eta:    'Available',
          fault:  '',
          source: 'TECH',
        };
      });

    if (activeJob && !jobIds.has(activeJob.id)) {
      const hasCritical = activeJob.inventory?.specialized?.some(i => i.health === 'RED');
      const stored      = posMap[activeJob.id] || {};
      jobUnits.push({
        id:     activeJob.id,
        name:   `${activeJob.unit || 'Active Unit'} (Current Job)`,
        status: hasCritical ? 'CRITICAL' : activeJob.status === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'ON_JOB',
        lat:    stored.lat ?? null,
        lng:    stored.lng ?? null,
        eta:    activeJob.status === 'IN_TRANSIT' ? 'En Route' : 'At Shop',
        fault:  hasCritical ? 'FLUX PMI ALERT' : '',
        source: 'JOB',
      });
    }

    return [...jobUnits, ...techUnits];
  }, [activeJob]);

  const [units, setUnits] = useState(buildUnits);

  useEffect(() => {
    const refresh = () => setUnits(buildUnits());
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [buildUnits]);

  const simulateGPS = (unitId) => {
    const pos = randomNearby(center);
    DataBridge.saveFleetUnit({ id: unitId, ...pos, updatedAt: new Date().toISOString() });
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, ...pos } : u));
  };

  const visibleUnits = units.filter(u => u.lat !== null && u.lng !== null);
  const ghostUnits = DataBridge.load('ghost_units') || [];

  return (
    <div style={{ padding: 0, backgroundColor: '#000000', color: '#e2e8f0', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* HUD OVERLAY HEADER */}
      <header style={{ position: 'absolute', top: 24, left: 24, right: 24, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none' }}>
        <div style={{ backgroundColor: 'rgba(15,23,42,0.90)', backdropFilter: 'blur(12px)', padding: 16, borderRadius: 16, border: '1px solid #334155', pointerEvents: 'auto' }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>HUB // Dispatch</h2>
          <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Fleet: {units.length} Unit{units.length !== 1 ? 's' : ''}</p>
        </div>

        <div style={{ backgroundColor: 'rgba(15,23,42,0.90)', backdropFilter: 'blur(12px)', padding: 16, borderRadius: 16, border: '1px solid #334155', pointerEvents: 'auto', textAlign: 'right' }}>
          {/* animate-pulse on Radio → ign-pulse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 4, justifyContent: 'flex-end' }}>
            <Radio size={12} className="ign-pulse" />
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Telematics</span>
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' }}>{shopName} Zone</p>
        </div>
      </header>

      {/* MAP VIEWPORT */}
      <div style={{ position: 'relative', flex: 1, minHeight: 380, backgroundColor: '#0f172a', overflow: 'hidden' }}>
        {/* filter blur-2xl grayscale → inline filter string (non-1:1 combination; flagged) */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s',
            filter: isExpired ? 'blur(40px) grayscale(100%)' : 'none',
            backgroundColor: '#020617',
            backgroundImage: 'linear-gradient(rgba(30,41,59,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            backgroundPosition: 'center center',
          }}
        >
          <div style={{ width: 500, height: 500, backgroundColor: 'rgba(37,99,235,0.05)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
        </div>

        {/* SHOP CENTER PIN */}
        {!isExpired && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-100%)' }}>
            <div style={{ padding: 6, borderRadius: '50%', backgroundColor: '#1e293b', border: '1px solid #475569' }}>
              <MapPin size={14} style={{ color: '#94a3b8' }} />
            </div>
            <p style={{ fontSize: 7, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', textAlign: 'center', marginTop: 2, whiteSpace: 'nowrap' }}>{shopName}</p>
          </div>
        )}

        {/* FLEET UNIT MARKERS */}
        {!isExpired && visibleUnits.map(unit => {
          const vp = toViewport(unit.lat, unit.lng, center);
          return (
            <div
              key={unit.id}
              style={{ position: 'absolute', transition: 'all 0.3s', cursor: 'pointer', top: vp.top, left: vp.left, transform: 'translate(-50%,-50%)' }}
            >
              {/* animate-pulse on CRITICAL → ign-pulse */}
              <div
                className={unit.status === 'CRITICAL' ? 'ign-pulse' : ''}
                style={{ padding: 8, borderRadius: '50%', border: '2px solid', ...getStatusStyle(unit.status) }}
              >
                <Truck size={16} style={{ color: '#ffffff' }} />
              </div>
              {/* group-hover:opacity-100 → dropped (no inline group-hover equivalent; tooltip hidden) */}
              <div style={{
                position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
                backgroundColor: '#0f172a', color: '#ffffff', padding: 8, borderRadius: 8,
                border: '1px solid #334155', opacity: 0, whiteSpace: 'nowrap', zIndex: 20,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}>
                <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em' }}>{unit.name}</p>
                <p style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase' }}>{unit.status} // ETA: {unit.eta}</p>
              </div>
            </div>
          );
        })}

        {/* GHOST / EXTERNAL CARRIER MARKERS */}
        {!isExpired && ghostUnits.map(unit => {
          if (unit.lat == null || unit.lng == null) return null;
          const vp = toViewport(unit.lat, unit.lng, center);
          return (
            <div
              key={unit.id}
              style={{ position: 'absolute', transition: 'all 0.3s', cursor: 'pointer', zIndex: 10, top: vp.top, left: vp.left, transform: 'translate(-50%,-50%)' }}
            >
              {/* animate-pulse → ign-pulse */}
              <div className="ign-pulse" style={{ padding: 8, borderRadius: '50%', border: '2px dashed #f97316', backgroundColor: '#0f172a', boxShadow: '0 0 15px rgba(249,115,22,0.6)' }}>
                <Package size={16} style={{ color: '#f97316' }} />
              </div>
              {/* group-hover:opacity-100 → dropped */}
              <div style={{
                position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
                backgroundColor: '#0f172a', color: '#ffffff', padding: 8, borderRadius: 8,
                border: '1px solid #334155', opacity: 0, whiteSpace: 'nowrap', zIndex: 20,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}>
                <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#f97316' }}>{unit.name}</p>
                <p style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase' }}>{unit.status} // ETA: {unit.eta}</p>
              </div>
            </div>
          );
        })}

        {/* No-units empty state */}
        {!isExpired && visibleUnits.length === 0 && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', paddingLeft: 32, paddingRight: 32 }}>
              No units on map<br />
              <span style={{ color: '#0f172a' }}>Use "Locate" in the unit list below to place a unit</span>
            </p>
          </div>
        )}

        {/* PAYWALL OVERLAY */}
        {isExpired && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(12px)', zIndex: 30 }}>
            <div style={{ backgroundColor: '#0f172a', padding: 32, borderRadius: 24, border: '1px solid rgba(59,130,246,0.30)', textAlign: 'center', maxWidth: 320, boxShadow: '0 25px 50px -12px rgba(30,58,138,0.50)' }}>
              <div style={{ width: 64, height: 64, backgroundColor: 'rgba(59,130,246,0.20)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid rgba(59,130,246,0.50)' }}>
                <Map size={32} style={{ color: '#3b82f6' }} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 8 }}>Logistics Locked</h3>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 24, textTransform: 'uppercase', lineHeight: 1.625, fontWeight: 700 }}>Your trial for HUB has expired. Live tracking and dispatching are hidden.</p>
              {/* hover:bg-blue-500 → ign-btn-primary */}
              <button className="ign-btn-primary" style={{ width: '100%', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 900, paddingTop: 16, paddingBottom: 16, borderRadius: 12, fontSize: 12, textTransform: 'uppercase', boxShadow: '0 10px 15px -3px rgba(30,58,138,0.40)', transition: 'all 0.15s', border: 'none', cursor: 'pointer' }}>
                Activate HUB
              </button>
            </div>
          </div>
        )}
      </div>

      {/* UNIT STATUS LIST */}
      <footer style={{ backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', padding: 24, maxHeight: 288, overflowY: 'auto', zIndex: 40 }}>
        <h3 style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={12} /> Fleet Unit Overview
        </h3>

        {units.length === 0 ? (
          <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', fontWeight: 900, textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>
            No active jobs or techs on record yet.<br />
            <span style={{ color: '#1e293b' }}>Create a job in INTAKE to see units here.</span>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {units.map(unit => (
              <div key={unit.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.40)', padding: 16, borderRadius: 16,
                border: unit.status === 'CRITICAL' ? '1px solid rgba(239,68,68,0.30)' : '1px solid #1e293b',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  {/* animate-pulse on active units → ign-pulse */}
                  <div
                    className={unit.status !== 'CRITICAL' && unit.status !== 'IDLE' ? 'ign-pulse' : ''}
                    style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, ...getDotStyle(unit.status) }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</p>
                    {unit.status === 'CRITICAL' && (
                      <p style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertCircle size={10} />FAULT: {unit.fault}
                      </p>
                    )}
                    {unit.lat !== null && (
                      <p style={{ fontSize: 8, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>{unit.lat.toFixed(4)}, {unit.lng.toFixed(4)}</p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', fontStyle: 'italic' }}>ETA</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>{unit.eta}</p>
                  </div>
                  {/* hover:text-blue-400 hover:border-blue-400/50 → dropped (cosmetic) */}
                  {!isExpired && (
                    <button
                      onClick={() => simulateGPS(unit.id)}
                      style={{
                        fontSize: 8, fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase',
                        border: '1px solid rgba(59,130,246,0.30)', paddingLeft: 8, paddingRight: 8,
                        paddingTop: 4, paddingBottom: 4, borderRadius: 8, transition: 'color 0.15s',
                        background: 'none', cursor: 'pointer',
                      }}
                      title="Simulate GPS ping for demo"
                    >
                      Locate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
};

export default IgnitionHub;
