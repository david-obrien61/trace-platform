/**
 * FILE: modules/QuickBooksConnector.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Standalone QuickBooks connection manager. Handles OAuth initiation,
 *          connection status display, customer/invoice sync, and disconnect.
 *          Used in OMNI Settings and the Onboarding Wizard.
 */

import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertCircle, RefreshCw, Link2, Link2Off, DollarSign, Users, ChevronRight } from 'lucide-react';
import ExternalBridge from '../ExternalBridge';

const QBO_CALLBACK_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'http://localhost:8000'
) + '/api/qbo/callback';

const StatusBadge = ({ connected }) => (
  <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase ${connected ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
    {connected ? 'Connected' : 'Not Connected'}
  </span>
);

const QuickBooksConnector = ({ onConnected }) => {
  const [connection, setConnection]   = useState(ExternalBridge.getConnections().quickbooks);
  const [phase, setPhase]             = useState('IDLE'); // IDLE | CONNECTING | SYNCING | ERROR
  const [message, setMessage]         = useState('');
  const [syncStats, setSyncStats]     = useState(null);
  const [liveStatus, setLiveStatus]   = useState(null);

  // On mount, verify live connection status with the backend
  useEffect(() => {
    if (connection.connected) {
      ExternalBridge.qbo.getStatus()
        .then(s => setLiveStatus(s))
        .catch(() => setLiveStatus({ connected: false }));
    }
  }, [connection.connected]);

  const connect = async () => {
    setPhase('CONNECTING');
    setMessage('Opening QuickBooks authorization window...');
    try {
      const status = await ExternalBridge.qbo.initiateOAuth();
      setConnection(ExternalBridge.getConnections().quickbooks);
      setLiveStatus(status);
      setPhase('SYNCING');
      setMessage('Authorization successful! Pulling your data...');
      await runSync();
      if (onConnected) onConnected(status);
    } catch (e) {
      setPhase('ERROR');
      setMessage(e.message);
    }
  };

  const runSync = async () => {
    setPhase('SYNCING');
    setMessage('Fetching customers...');
    try {
      const customerResult = await ExternalBridge.qbo.pullCustomers();
      setMessage('Fetching recent invoices...');
      const invoiceResult = await ExternalBridge.qbo.pullInvoices(90);
      const stats = {
        customers: customerResult.imported,
        invoices:  invoiceResult.imported,
        syncedAt:  new Date().toLocaleString(),
      };
      setSyncStats(stats);
      setConnection(ExternalBridge.getConnections().quickbooks);
      setPhase('IDLE');
      setMessage('');
    } catch (e) {
      setPhase('ERROR');
      setMessage(`Sync failed: ${e.message}`);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect QuickBooks? Your imported data will remain, but future syncs will stop.')) return;
    await ExternalBridge.qbo.disconnect();
    setConnection(ExternalBridge.getConnections().quickbooks);
    setLiveStatus(null);
    setSyncStats(null);
    setPhase('IDLE');
    setMessage('');
  };

  const isConnected = connection.connected && liveStatus?.connected !== false;

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen">
      <header className="mb-8 border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">QuickBooks</h2>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Accounting Integration</p>
          </div>
          <StatusBadge connected={isConnected} />
        </div>
      </header>

      {/* CONNECTION CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-6 shadow-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-green-600/10 border border-green-500/20 rounded-2xl flex items-center justify-center">
            <Database size={28} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase italic tracking-tighter">QuickBooks Online</p>
            {isConnected && connection.companyName && (
              <p className="text-[10px] text-emerald-400 font-bold">{connection.companyName}</p>
            )}
            {isConnected && connection.connectedAt && (
              <p className="text-[9px] text-slate-500">Connected {new Date(connection.connectedAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div className={`flex items-center gap-2 rounded-xl p-3 mb-4 ${phase === 'ERROR' ? 'bg-red-400/5 border border-red-400/20' : 'bg-blue-400/5 border border-blue-400/20'}`}>
            {phase === 'ERROR' ? <AlertCircle size={14} className="text-red-400" /> : <RefreshCw size={14} className="text-blue-400 animate-spin" />}
            <p className={`text-[10px] font-bold ${phase === 'ERROR' ? 'text-red-400' : 'text-blue-400'}`}>{message}</p>
          </div>
        )}

        {/* Action buttons */}
        {!isConnected ? (
          <button
            onClick={connect}
            disabled={phase === 'CONNECTING'}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-lg shadow-green-900/30 active:scale-95 flex items-center justify-center gap-2"
          >
            <Link2 size={14} />
            {phase === 'CONNECTING' ? 'Authorizing...' : 'Connect to QuickBooks'}
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={runSync}
              disabled={phase === 'SYNCING'}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={phase === 'SYNCING' ? 'animate-spin' : ''} />
              {phase === 'SYNCING' ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={disconnect}
              className="px-5 py-4 bg-slate-900 border border-slate-800 hover:border-red-500/50 text-slate-500 hover:text-red-400 rounded-2xl font-black text-[10px] uppercase transition-colors flex items-center gap-2"
            >
              <Link2Off size={14} />
            </button>
          </div>
        )}

        <p className="text-[8px] text-slate-600 text-center mt-3 uppercase tracking-wider">
          Requires QuickBooks Online. A popup will open for authorization.
        </p>
      </div>

      {/* SYNC STATS */}
      {(syncStats || isConnected) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-blue-400" />
              <p className="text-[9px] font-black text-slate-500 uppercase">Customers Synced</p>
            </div>
            <p className="text-3xl font-black text-white italic">
              {syncStats?.customers ?? '—'}
            </p>
            {syncStats?.syncedAt && (
              <p className="text-[8px] text-slate-600 mt-1">Last: {syncStats.syncedAt}</p>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={14} className="text-emerald-400" />
              <p className="text-[9px] font-black text-slate-500 uppercase">Invoices Pulled</p>
            </div>
            <p className="text-3xl font-black text-white italic">
              {syncStats?.invoices ?? '—'}
            </p>
            <p className="text-[8px] text-slate-600 mt-1">Last 90 days</p>
          </div>
        </div>
      )}

      {/* WHAT SYNCS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">What Gets Synced</p>
        <div className="space-y-3">
          {[
            { label: 'Customer names, phones, and emails', dir: '← From QuickBooks', active: true },
            { label: 'Last 90 days of invoices and payment status', dir: '← From QuickBooks', active: true },
            { label: 'Completed work orders as invoices', dir: '→ To QuickBooks', active: false, coming: true },
            { label: 'Payment status updates', dir: '← From QuickBooks', active: false, coming: true },
          ].map(({ label, dir, active, coming }) => (
            <div key={label} className="flex items-center gap-3">
              <CheckCircle size={14} className={active ? 'text-emerald-400' : coming ? 'text-slate-700' : 'text-slate-700'} />
              <div className="flex-1">
                <p className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{label}</p>
                <p className="text-[8px] text-slate-600 font-mono">{dir}{coming ? ' · Coming soon' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SETUP INSTRUCTIONS */}
      {!isConnected && (
        <div className="mt-6 bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Setup Required</p>
          <div className="space-y-3">
            {[
              'Create a free app at developer.intuit.com',
              `Set Redirect URI to: ${QBO_CALLBACK_URL}`,
              'Copy your Client ID and Client Secret into the .env file',
              'Restart the Python backend (shop_estimate.py)',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center text-[8px] font-black text-slate-400 flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-[10px] text-slate-400">{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-black rounded-xl p-3 font-mono text-[9px] text-slate-500">
            <p className="text-slate-600"># Add to your .env file:</p>
            <p className="text-emerald-400">QBO_CLIENT_ID=<span className="text-slate-500">your_client_id_here</span></p>
            <p className="text-emerald-400">QBO_CLIENT_SECRET=<span className="text-slate-500">your_secret_here</span></p>
            <p className="text-emerald-400">QBO_ENVIRONMENT=<span className="text-slate-500">sandbox</span></p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickBooksConnector;
