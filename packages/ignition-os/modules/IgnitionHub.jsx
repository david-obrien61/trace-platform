/**
 * MODULE: HUB (Dispatch & Logistics)
 * VERSION: v1.1.0
 * DESC: Live map-based dispatching. Units derived from active jobs + tech profiles.
 *       Positions stored in DataBridge fleet_units; "Simulate GPS" seeds coords for demo.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Map, Navigation, Truck, AlertCircle, Radio, Clock, Lock, Package, MapPin } from 'lucide-react';
import DataBridge from '../DataBridge';

// Leander, TX center — used when shop_info has no coords
const DEFAULT_CENTER = { lat: 30.5788, lng: -97.8531 };

// Map a [0,1] viewport fraction to lat/lng given a center and ~10-mile spread
const SPREAD_LAT = 0.12;
const SPREAD_LNG = 0.16;

const toViewport = (lat, lng, center) => ({
  top:  `${50 - ((lat  - center.lat) / SPREAD_LAT)  * 50}%`,
  left: `${50 + ((lng  - center.lng) / SPREAD_LNG) * 50}%`,
});

// Scatter a position randomly within ~3 miles of center (for demo)
const randomNearby = (center) => ({
  lat: center.lat + (Math.random() - 0.5) * 0.06,
  lng: center.lng + (Math.random() - 0.5) * 0.08,
});

const statusColor = (status) => {
  if (status === 'CRITICAL')    return 'bg-red-500 border-white shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse';
  if (status === 'IN_TRANSIT')  return 'bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.5)]';
  if (status === 'IDLE')        return 'bg-slate-600 border-slate-500 shadow-none';
  return 'bg-emerald-600 border-white shadow-[0_0_15px_rgba(16,185,129,0.5)]';
};

const dotColor = (status) => {
  if (status === 'CRITICAL')   return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]';
  if (status === 'IDLE')       return 'bg-slate-600';
  return 'bg-emerald-500 animate-pulse';
};

const IgnitionHub = ({ activeJob }) => {
  const { isExpired } = DataBridge.checkTrialStatus('HUB');
  const shopInfo  = DataBridge.load('shop_info') || {};
  const shopName  = shopInfo.name || 'Your Shop';
  const center    = DEFAULT_CENTER; // extend later: geocode shopInfo.address

  const buildUnits = useCallback(() => {
    const jobs     = DataBridge.getJobs();
    const profiles = DataBridge.getProfiles();
    const stored   = DataBridge.getFleetUnits();
    const posMap   = Object.fromEntries(stored.map(u => [u.id, u]));

    // Active jobs → fleet units
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

    // Tech profiles without an active job → IDLE units
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

    // If activeJob prop is passed (from CoreApp) and not already in the list, add it
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

  // Refresh units when localStorage changes (e.g. after a job status update)
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

  // External carrier shadow units from stored ghost_units (manual dispatch entries)
  const ghostUnits = DataBridge.load('ghost_units') || [];

  return (
    <div className="p-0 bg-black text-slate-200 min-h-screen flex flex-col relative">
      {/* HUD OVERLAY HEADER */}
      <header className="absolute top-6 left-6 right-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 pointer-events-auto">
          <h2 className="text-xl font-black italic text-blue-500 uppercase tracking-tighter">HUB // Dispatch</h2>
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Active Fleet: {units.length} Unit{units.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 pointer-events-auto text-right">
          <div className="flex items-center gap-2 text-emerald-500 mb-1 justify-end">
            <Radio size={12} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Telematics</span>
          </div>
          <p className="text-xs font-bold text-white uppercase">{shopName} Zone</p>
        </div>
      </header>

      {/* MAP VIEWPORT */}
      <div className="relative flex-1 min-h-[380px] bg-slate-900 overflow-hidden">
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all ${isExpired ? 'filter blur-2xl grayscale' : ''}`}
          style={{
            backgroundColor: '#020617',
            backgroundImage: 'linear-gradient(rgba(30,41,59,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            backgroundPosition: 'center center',
          }}
        >
          <div className="w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[80px] pointer-events-none" />
        </div>

        {/* SHOP CENTER PIN */}
        {!isExpired && (
          <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-100%)' }}>
            <div className="p-1.5 rounded-full bg-slate-800 border border-slate-600">
              <MapPin size={14} className="text-slate-400" />
            </div>
            <p className="text-[7px] font-black text-slate-500 uppercase text-center mt-0.5 whitespace-nowrap">{shopName}</p>
          </div>
        )}

        {/* FLEET UNIT MARKERS */}
        {!isExpired && visibleUnits.map(unit => {
          const vp = toViewport(unit.lat, unit.lng, center);
          return (
            <div
              key={unit.id}
              className="absolute transition-all cursor-pointer group"
              style={{ top: vp.top, left: vp.left, transform: 'translate(-50%,-50%)' }}
            >
              <div className={`p-2 rounded-full border-2 ${statusColor(unit.status)}`}>
                <Truck size={16} className="text-white" />
              </div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 rounded-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-tighter">{unit.name}</p>
                <p className="text-[8px] text-slate-400 uppercase">{unit.status} // ETA: {unit.eta}</p>
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
              className="absolute transition-all cursor-pointer group z-10"
              style={{ top: vp.top, left: vp.left, transform: 'translate(-50%,-50%)' }}
            >
              <div className="p-2 rounded-full border-2 border-orange-500 border-dashed bg-slate-900 shadow-[0_0_15px_rgba(249,115,22,0.6)] animate-pulse">
                <Package size={16} className="text-orange-500" />
              </div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 rounded-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-tighter text-orange-500">{unit.name}</p>
                <p className="text-[8px] text-slate-400 uppercase">{unit.status} // ETA: {unit.eta}</p>
              </div>
            </div>
          );
        })}

        {/* No-units empty state */}
        {!isExpired && visibleUnits.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest text-center px-8">
              No units on map<br />
              <span className="text-slate-800">Use "Locate" in the unit list below to place a unit</span>
            </p>
          </div>
        )}

        {/* PAYWALL OVERLAY */}
        {isExpired && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-30">
            <div className="bg-slate-900 p-8 rounded-3xl border border-blue-500/30 text-center max-w-xs shadow-2xl shadow-blue-900/50">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50">
                <Map size={32} className="text-blue-500" />
              </div>
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">Logistics Locked</h3>
              <p className="text-xs text-slate-400 mb-6 uppercase leading-relaxed font-bold">Your trial for HUB has expired. Live tracking and dispatching are hidden.</p>
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl text-xs uppercase shadow-lg shadow-blue-900/40 transition">Activate HUB</button>
            </div>
          </div>
        )}
      </div>

      {/* UNIT STATUS LIST */}
      <footer className="bg-slate-900 border-t border-slate-800 p-6 max-h-72 overflow-y-auto z-40">
        <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
          <Truck size={12} /> Fleet Unit Overview
        </h3>

        {units.length === 0 ? (
          <p className="text-[10px] text-slate-600 uppercase font-black text-center py-4">
            No active jobs or techs on record yet.<br />
            <span className="text-slate-700">Create a job in INTAKE to see units here.</span>
          </p>
        ) : (
          <div className="grid gap-3">
            {units.map(unit => (
              <div key={unit.id} className={`flex justify-between items-center bg-black/40 p-4 rounded-2xl border ${unit.status === 'CRITICAL' ? 'border-red-500/30' : 'border-slate-800'}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(unit.status)}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white uppercase italic truncate">{unit.name}</p>
                    {unit.status === 'CRITICAL' && (
                      <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-1">
                        <AlertCircle size={10} className="inline mr-1" />FAULT: {unit.fault}
                      </p>
                    )}
                    {unit.lat !== null && (
                      <p className="text-[8px] text-slate-600 font-mono mt-0.5">{unit.lat.toFixed(4)}, {unit.lng.toFixed(4)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase italic">ETA</p>
                    <p className="text-sm font-black text-white">{unit.eta}</p>
                  </div>
                  {!isExpired && (
                    <button
                      onClick={() => simulateGPS(unit.id)}
                      className="text-[8px] font-black text-blue-500 hover:text-blue-400 uppercase border border-blue-500/30 hover:border-blue-400/50 px-2 py-1 rounded-lg transition-colors"
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
