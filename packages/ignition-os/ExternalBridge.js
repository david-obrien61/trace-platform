/**
 * FILE: ExternalBridge.js
 * PLATFORM: Universal (Web)
 * PURPOSE: Translation layer between external systems (QuickBooks, CSV) and DataBridge.
 *          Keeps DataBridge clean as internal source of truth; this file owns all
 *          third-party format mapping, OAuth state, and sync tracking.
 */

import DataBridge from './DataBridge';

const API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:8000';

// ─── CONNECTION STATUS ────────────────────────────────────────────────────────

const getConnections = () => {
  return DataBridge.load('external_connections') || {
    quickbooks: { connected: false, realmId: null, companyName: null, connectedAt: null, lastSync: null },
    csv: { lastImport: null, recordsImported: 0 },
  };
};

const saveConnection = (type, data) => {
  const current = getConnections();
  const updated = { ...current, [type]: { ...current[type], ...data } };
  DataBridge.save('external_connections', updated);
};

// ─── QUICKBOOKS BRIDGE ────────────────────────────────────────────────────────

const qbo = {
  /**
   * Step 1: Ask backend for the Intuit OAuth URL, then open it in a popup.
   * The popup redirects to Intuit → user approves → Intuit hits our /api/qbo/callback.
   * The backend stores the tokens; frontend polls /api/qbo/status to confirm.
   */
  initiateOAuth: async () => {
    try {
      const res = await fetch(`${API_URL}/api/qbo/auth-url`);
      if (!res.ok) throw new Error('Backend unavailable. Make sure shop_estimate.py is running.');
      const { url } = await res.json();

      const popup = window.open(url, 'qbo_auth', 'width=600,height=700,left=200,top=100');
      if (!popup) throw new Error('Popup blocked. Please allow popups for this page and try again.');

      return new Promise((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const status = await qbo.getStatus();
            if (status.connected) {
              clearInterval(poll);
              saveConnection('quickbooks', {
                connected: true,
                realmId: status.realmId,
                companyName: status.companyName,
                connectedAt: new Date().toISOString(),
              });
              resolve(status);
            }
            if (popup.closed && !status.connected) {
              clearInterval(poll);
              reject(new Error('Authorization cancelled.'));
            }
          } catch (e) {
            clearInterval(poll);
            reject(e);
          }
        }, 2000);

        // Timeout after 3 minutes
        setTimeout(() => {
          clearInterval(poll);
          reject(new Error('Authorization timed out. Please try again.'));
        }, 180000);
      });
    } catch (e) {
      throw new Error(e.message);
    }
  },

  getStatus: async () => {
    const res = await fetch(`${API_URL}/api/qbo/status`);
    if (!res.ok) return { connected: false };
    return res.json();
  },

  disconnect: async () => {
    await fetch(`${API_URL}/api/qbo/disconnect`, { method: 'POST' });
    saveConnection('quickbooks', { connected: false, realmId: null, companyName: null });
  },

  /**
   * Pull customers from QuickBooks and map to DataBridge customer schema.
   * Returns: { imported: number, customers: array }
   */
  pullCustomers: async () => {
    const res = await fetch(`${API_URL}/api/qbo/customers`);
    if (!res.ok) throw new Error('Failed to fetch QuickBooks customers.');
    const { customers: rawCustomers } = await res.json();

    const mapped = rawCustomers.map(qbo.mapCustomer).filter(Boolean);

    // Merge with existing — don't overwrite if ID already exists
    const existing = DataBridge.getCustomers();
    const existingIds = new Set(existing.map(c => c.id));
    const newOnes = mapped.filter(c => !existingIds.has(c.id));
    const merged = [...existing, ...newOnes];

    DataBridge.save('customers_directory', merged);
    saveConnection('quickbooks', { lastSync: new Date().toISOString() });

    return { imported: newOnes.length, customers: merged };
  },

  /**
   * Pull last N days of invoices from QuickBooks.
   * Returns: { imported: number, invoices: array }
   */
  pullInvoices: async (days = 90) => {
    const res = await fetch(`${API_URL}/api/qbo/invoices?days=${days}`);
    if (!res.ok) throw new Error('Failed to fetch QuickBooks invoices.');
    const { invoices: rawInvoices } = await res.json();

    const mapped = rawInvoices.map(qbo.mapInvoice).filter(Boolean);

    const existing = DataBridge.load('invoice_history') || [];
    const existingIds = new Set(existing.map(i => i.id));
    const newOnes = mapped.filter(i => !existingIds.has(i.id));

    DataBridge.save('invoice_history', [...existing, ...newOnes]);

    return { imported: newOnes.length, invoices: mapped };
  },

  /**
   * Push a completed CAI invoice back to QuickBooks.
   */
  pushInvoice: async (invoice) => {
    const qboPayload = qbo.toQboInvoice(invoice);
    const res = await fetch(`${API_URL}/api/qbo/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qboPayload),
    });
    if (!res.ok) throw new Error('Failed to push invoice to QuickBooks.');
    return res.json();
  },

  // ── Format translators ──────────────────────────────────────────────────────

  mapCustomer: (raw) => {
    if (!raw || !raw.DisplayName) return null;
    return {
      id: `QBO-${raw.Id}`,
      name: raw.DisplayName,
      phone: raw.PrimaryPhone?.FreeFormNumber || '',
      email: raw.PrimaryEmailAddr?.Address || '',
      address: raw.BillAddr
        ? `${raw.BillAddr.Line1 || ''}, ${raw.BillAddr.City || ''}, ${raw.BillAddr.CountrySubDivisionCode || ''}`
        : '',
      type: raw.Job ? 'CONTRACT' : 'PERSONAL',
      tier: 'STANDARD',
      source: 'QUICKBOOKS',
      qboId: raw.Id,
      vehicles: [],
    };
  },

  mapInvoice: (raw) => {
    if (!raw || !raw.Id) return null;
    const total = parseFloat(raw.TotalAmt || 0);
    const balance = parseFloat(raw.Balance || 0);
    return {
      id: `QBO-INV-${raw.Id}`,
      qboId: raw.Id,
      customerId: raw.CustomerRef?.value ? `QBO-${raw.CustomerRef.value}` : null,
      customerName: raw.CustomerRef?.name || '',
      date: raw.TxnDate,
      dueDate: raw.DueDate,
      total,
      balance,
      paid: total - balance,
      status: balance === 0 ? 'PAID' : balance === total ? 'UNPAID' : 'PARTIAL',
      lineItems: (raw.Line || [])
        .filter(l => l.DetailType === 'SalesItemLineDetail')
        .map(l => ({
          description: l.Description || l.SalesItemLineDetail?.ItemRef?.name || '',
          qty: l.SalesItemLineDetail?.Qty || 1,
          unitPrice: l.SalesItemLineDetail?.UnitPrice || 0,
          amount: l.Amount || 0,
        })),
      source: 'QUICKBOOKS',
    };
  },

  toQboInvoice: (caiInvoice) => ({
    CustomerRef: { value: caiInvoice.qboCustomerId },
    Line: (caiInvoice.lineItems || []).map(item => ({
      Amount: item.amount,
      DetailType: 'SalesItemLineDetail',
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.qty,
        UnitPrice: item.unitPrice,
        ItemRef: { value: '1', name: item.description },
      },
    })),
    TxnDate: new Date().toISOString().split('T')[0],
  }),
};

// ─── CSV BRIDGE ───────────────────────────────────────────────────────────────

const csv = {
  /**
   * Read a File object and return parsed rows + detected column mapping.
   */
  parse: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length < 2) return reject(new Error('File appears empty or has no data rows.'));

          const headers = csv.parseRow(lines[0]);
          const rows = lines.slice(1).map(l => {
            const values = csv.parseRow(l);
            const row = {};
            headers.forEach((h, i) => { row[h] = values[i] || ''; });
            return row;
          }).filter(r => Object.values(r).some(v => v.trim()));

          const mapping = csv.detectColumns(headers);
          resolve({ headers, rows, mapping, totalRows: rows.length });
        } catch (e) {
          reject(new Error('Could not parse file. Make sure it is a valid CSV.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsText(file);
    });
  },

  parseRow: (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  },

  detectColumns: (headers) => {
    const lower = headers.map(h => h.toLowerCase());
    const find = (...terms) => {
      const idx = lower.findIndex(h => terms.some(t => h.includes(t)));
      return idx >= 0 ? headers[idx] : null;
    };
    return {
      name:    find('name', 'customer', 'client', 'contact', 'full name'),
      phone:   find('phone', 'tel', 'mobile', 'cell', 'contact number'),
      email:   find('email', 'mail', 'e-mail'),
      address: find('address', 'street', 'location'),
      city:    find('city', 'town'),
      state:   find('state', 'province', 'region'),
      zip:     find('zip', 'postal', 'postcode'),
      vehicle: find('vehicle', 'unit', 'truck', 'car'),
      vin:     find('vin', 'serial'),
      year:    find('year', 'yr', 'model year'),
      make:    find('make', 'brand', 'manufacturer'),
      model:   find('model'),
      notes:   find('notes', 'comments', 'memo'),
    };
  },

  /**
   * Convert parsed rows into DataBridge customer objects using a column mapping.
   */
  mapToCustomers: (rows, mapping) => {
    let counter = DataBridge.getCustomers().length + 1;
    return rows.map(row => {
      const name = mapping.name ? row[mapping.name] : '';
      if (!name) return null;

      const address = [
        mapping.address ? row[mapping.address] : '',
        mapping.city    ? row[mapping.city]    : '',
        mapping.state   ? row[mapping.state]   : '',
        mapping.zip     ? row[mapping.zip]     : '',
      ].filter(Boolean).join(', ');

      const vehicle = {
        year:  mapping.year  ? row[mapping.year]  : '',
        make:  mapping.make  ? row[mapping.make]  : '',
        model: mapping.model ? row[mapping.model] : '',
        vin:   mapping.vin   ? row[mapping.vin]   : '',
      };
      const hasVehicle = Object.values(vehicle).some(v => v);

      return {
        id: `CSV-${String(counter++).padStart(4, '0')}`,
        name,
        phone:   mapping.phone   ? row[mapping.phone]   : '',
        email:   mapping.email   ? row[mapping.email]   : '',
        address,
        type:    'PERSONAL',
        tier:    'STANDARD',
        source:  'CSV_IMPORT',
        importedAt: new Date().toISOString(),
        vehicles: hasVehicle ? [vehicle] : [],
        notes:   mapping.notes ? row[mapping.notes] : '',
      };
    }).filter(Boolean);
  },

  /**
   * Import mapped customers into DataBridge, skipping duplicates by name+phone.
   */
  importCustomers: (customers) => {
    const existing = DataBridge.getCustomers();
    const existingKeys = new Set(existing.map(c => `${c.name}|${c.phone}`));
    const newOnes = customers.filter(c => !existingKeys.has(`${c.name}|${c.phone}`));
    DataBridge.save('customers_directory', [...existing, ...newOnes]);

    const connections = getConnections();
    saveConnection('csv', {
      lastImport: new Date().toISOString(),
      recordsImported: (connections.csv.recordsImported || 0) + newOnes.length,
    });

    return { imported: newOnes.length, skipped: customers.length - newOnes.length };
  },
};

// ─── MARGIN ANALYTICS ────────────────────────────────────────────────────────

const analytics = {
  /**
   * Group transaction_history by quarter and compute margin stats per quarter.
   */
  getQuarterlyMargins: () => {
    const history = DataBridge.load('transaction_history') || [];
    const grouped = {};

    history.forEach(tx => {
      if (!tx.timestamp) return;
      const d = new Date(tx.timestamp);
      const q = `Q${Math.ceil((d.getMonth() + 1) / 3)}-${d.getFullYear()}`;
      if (!grouped[q]) grouped[q] = { quarter: q, transactions: [], totalRevenue: 0, totalCost: 0 };
      grouped[q].transactions.push(tx);
      grouped[q].totalRevenue += tx.actualPrice || 0;
      grouped[q].totalCost    += tx.cost        || 0;
    });

    return Object.values(grouped).map(g => ({
      ...g,
      avgMarginPct: g.totalCost > 0
        ? (((g.totalRevenue - g.totalCost) / g.totalRevenue) * 100).toFixed(1)
        : null,
      count: g.transactions.length,
    })).sort((a, b) => a.quarter.localeCompare(b.quarter));
  },

  /**
   * For each entry in margin_change_log, compute avg margin 30 days before vs. after.
   */
  getChangeImpact: () => {
    const log    = DataBridge.load('margin_change_log') || [];
    const history = DataBridge.load('transaction_history') || [];

    return log.map(change => {
      const changeTime = new Date(change.changed_at).getTime();
      const window = 30 * 24 * 60 * 60 * 1000;

      const before = history.filter(tx => tx.timestamp && tx.timestamp > changeTime - window && tx.timestamp < changeTime);
      const after  = history.filter(tx => tx.timestamp && tx.timestamp > changeTime && tx.timestamp < changeTime + window);

      const avgMargin = (txs) => {
        if (!txs.length) return null;
        const total = txs.reduce((s, tx) => s + ((tx.actualPrice - (tx.cost || 0)) / (tx.actualPrice || 1) * 100), 0);
        return (total / txs.length).toFixed(1);
      };

      return {
        ...change,
        beforeAvgMargin: avgMargin(before),
        afterAvgMargin:  avgMargin(after),
        beforeCount: before.length,
        afterCount:  after.length,
      };
    });
  },
};

const ExternalBridge = { getConnections, saveConnection, qbo, csv, analytics };
export default ExternalBridge;
