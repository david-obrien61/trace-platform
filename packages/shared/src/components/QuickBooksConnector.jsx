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

const STYLE_DEBUG = true; // [TRACE:STYLE] STD-003

const QBO_CALLBACK_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'http://localhost:8000'
) + '/api/qbo/callback';

const StatusBadge = ({ connected }) => (
  <span style={{
    fontSize: 8, fontWeight: 900, padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase',
    backgroundColor: connected ? 'rgba(5,150,105,0.2)' : '#1e293b',
    color: connected ? '#34d399' : '#64748b',
  }}>
    {connected ? 'Connected' : 'Not Connected'}
  </span>
);

const QuickBooksConnector = ({ onConnected }) => {
  const [connection, setConnection]   = useState(ExternalBridge.getConnections().quickbooks);
  const [phase, setPhase]             = useState('IDLE'); // IDLE | CONNECTING | SYNCING | ERROR
  const [message, setMessage]         = useState('');
  const [syncStats, setSyncStats]     = useState(null);
  const [liveStatus, setLiveStatus]   = useState(null);

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
    <div style={{ padding: 24, backgroundColor: '#020617', color: '#e2e8f0', minHeight: '100vh' }}>
      <header style={{ marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>QuickBooks</h2>
            <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Accounting Integration</p>
          </div>
          <StatusBadge connected={isConnected} />
        </div>
      </header>

      {/* CONNECTION CARD */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, marginBottom: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, backgroundColor: 'rgba(22,163,74,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={28} color="#4ade80" />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em' }}>QuickBooks Online</p>
            {isConnected && connection.companyName && (
              <p style={{ fontSize: 10, color: '#34d399', fontWeight: 700 }}>{connection.companyName}</p>
            )}
            {isConnected && connection.connectedAt && (
              <p style={{ fontSize: 9, color: '#64748b' }}>Connected {new Date(connection.connectedAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 16,
            backgroundColor: phase === 'ERROR' ? 'rgba(248,113,113,0.05)' : 'rgba(96,165,250,0.05)',
            border: phase === 'ERROR' ? '1px solid rgba(248,113,113,0.2)' : '1px solid rgba(96,165,250,0.2)',
          }}>
            {phase === 'ERROR'
              ? <AlertCircle size={14} color="#f87171" />
              : <RefreshCw size={14} color="#60a5fa" className="ign-spin" />}
            <p style={{ fontSize: 10, fontWeight: 700, color: phase === 'ERROR' ? '#f87171' : '#60a5fa' }}>{message}</p>
          </div>
        )}

        {/* Action buttons */}
        {!isConnected ? (
          <button
            onClick={connect}
            disabled={phase === 'CONNECTING'}
            style={{
              width: '100%', fontWeight: 900, padding: '16px 0', borderRadius: 16,
              textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: 'none', cursor: phase === 'CONNECTING' ? 'not-allowed' : 'pointer',
              backgroundColor: phase === 'CONNECTING' ? '#1e293b' : '#16a34a',
              color: phase === 'CONNECTING' ? '#475569' : '#fff',
              boxShadow: phase === 'CONNECTING' ? 'none' : '0 10px 15px rgba(20,83,45,0.3)',
            }}
          >
            <Link2 size={14} />
            {phase === 'CONNECTING' ? 'Authorizing...' : 'Connect to QuickBooks'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={runSync}
              disabled={phase === 'SYNCING'}
              style={{
                flex: 1, fontWeight: 900, padding: '16px 0', borderRadius: 16,
                textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                border: 'none', cursor: phase === 'SYNCING' ? 'not-allowed' : 'pointer',
                backgroundColor: phase === 'SYNCING' ? '#1e293b' : '#2563eb',
                color: phase === 'SYNCING' ? '#475569' : '#fff',
              }}
            >
              <RefreshCw size={14} className={phase === 'SYNCING' ? 'ign-spin' : undefined} />
              {phase === 'SYNCING' ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={disconnect}
              style={{
                padding: '16px 20px', backgroundColor: '#0f172a', border: '1px solid #1e293b',
                color: '#64748b', borderRadius: 16, fontWeight: 900, fontSize: 10,
                textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer',
              }}
            >
              <Link2Off size={14} />
            </button>
          </div>
        )}

        <p style={{ fontSize: 8, color: '#475569', textAlign: 'center', marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Requires QuickBooks Online. A popup will open for authorization.
        </p>
      </div>

      {/* SYNC STATS */}
      {(syncStats || isConnected) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Users size={14} color="#60a5fa" />
              <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Customers Synced</p>
            </div>
            <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>
              {syncStats?.customers ?? '—'}
            </p>
            {syncStats?.syncedAt && (
              <p style={{ fontSize: 8, color: '#475569', marginTop: 4 }}>Last: {syncStats.syncedAt}</p>
            )}
          </div>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <DollarSign size={14} color="#34d399" />
              <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Invoices Pulled</p>
            </div>
            <p style={{ fontSize: 30, fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>
              {syncStats?.invoices ?? '—'}
            </p>
            <p style={{ fontSize: 8, color: '#475569', marginTop: 4 }}>Last 90 days</p>
          </div>
        </div>
      )}

      {/* WHAT SYNCS */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>What Gets Synced</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Customer names, phones, and emails', dir: '← From QuickBooks', active: true },
            { label: 'Last 90 days of invoices and payment status', dir: '← From QuickBooks', active: true },
            { label: 'Completed work orders as invoices', dir: '→ To QuickBooks', active: false, coming: true },
            { label: 'Payment status updates', dir: '← From QuickBooks', active: false, coming: true },
          ].map(({ label, dir, active, coming }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle size={14} color={active ? '#34d399' : '#374151'} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: active ? '#fff' : '#475569' }}>{label}</p>
                <p style={{ fontSize: 8, color: '#475569', fontFamily: 'monospace' }}>{dir}{coming ? ' · Coming soon' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SETUP INSTRUCTIONS */}
      {!isConnected && (
        <div style={{ marginTop: 24, backgroundColor: 'rgba(15,23,42,0.5)', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Setup Required</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              'Create a free app at developer.intuit.com',
              `Set Redirect URI to: ${QBO_CALLBACK_URL}`,
              'Copy your Client ID and Client Secret into the .env file',
              'Restart the Python backend (shop_estimate.py)',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 20, height: 20, backgroundColor: '#1e293b', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#94a3b8', flexShrink: 0, marginTop: 2 }}>
                  {i + 1}
                </div>
                <p style={{ fontSize: 10, color: '#94a3b8' }}>{step}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, backgroundColor: '#000', borderRadius: 12, padding: 12, fontFamily: 'monospace', fontSize: 9, color: '#64748b' }}>
            <p style={{ color: '#475569' }}># Add to your .env file:</p>
            <p style={{ color: '#34d399' }}>QBO_CLIENT_ID=<span style={{ color: '#64748b' }}>your_client_id_here</span></p>
            <p style={{ color: '#34d399' }}>QBO_CLIENT_SECRET=<span style={{ color: '#64748b' }}>your_secret_here</span></p>
            <p style={{ color: '#34d399' }}>QBO_ENVIRONMENT=<span style={{ color: '#64748b' }}>sandbox</span></p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickBooksConnector;
