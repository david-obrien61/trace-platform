/**
 * FILE: DataBridge.js
 * PLATFORM: Universal (Web & Mobile)
 * PURPOSE: Central storage and sync layer for Ignition OS. Handles Local-First persistence,
 *          Supabase cloud sync, Trial Clock synchronization, and Subscription metadata.
 */

import { supabase } from './supabase';

const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
let memoryStore = {};

// Mobile persistence via AsyncStorage — loaded dynamically so web builds are unaffected
let AsyncStorage = null;
if (!isWeb) {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    console.warn('[DataBridge] AsyncStorage unavailable — mobile data will not persist across restarts');
  }
}

// Dynamically route API calls based on platform
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL)
  || (isWeb ? `http://${window.location.hostname}:8000` : 'http://192.168.1.14:8000');

const DataBridge = {
  // Configuration
  isBackendConnected: false,
  storageKey: 'IGNITION_OS_DATA',

  /**
   * SYSTEM SCHEMAS
   * Defines the canonical shape of all persisted database objects.
   */
  SCHEMA: {
    system_subscriptions: {
      MODULE_ID: { active: 'boolean', tier: 'string', trialActive: 'boolean', trialStartedAt: 'ISOString|null' }
    },
    active_job_context: {
      id: 'string',
      unit: 'string',
      status: 'string (MOBILE_FIELD | AUTHORIZED | IN_TRANSIT)',
      inventory: { specialized: 'array', baseConfirmed: 'boolean' },
      notes: 'array of strings',
      assigned_crew_size: 'number|string',
      active_techs: 'array',
      tasks: 'array',        // Holds { id, description, suggested_hours, billed_hours, rate }
      labor_ledger: 'array'  // Holds { tech_id, start_time, end_time, task_id }
    },
    current_user: {
      id: 'string',
      name: 'string',
      pin: 'string',
      permissions: 'array'
    },
    users_table: 'array',
    pending_users: 'array',
    transaction_history: [{
      customer: 'string',
      tier: 'string',
      standardPrice: 'number',
      actualPrice: 'number',
      timestamp: 'number'
    }],
    prot_matrix: {
      anchor: 'number',
      fleetOffset: 'number',
      legacyOffset: 'number',
      ffFlat: 'number'
    },
    is_dot_mandated: 'boolean',
    shop_info: {
      name: 'string',
      is_multi_location: 'boolean',
      global_contact: {
        phone: 'string',
        email: 'string',
        address: 'string',
        usdot: 'string'
      },
      locations: [{
        id: 'string',
        label: 'string',
        phone: 'string',
        email: 'string',
        address: 'string',
        is_primary: 'boolean'
      }]
    },
    Hardware: [{
      id: 'string',
      description: 'string',
      owner_type: 'string (SHOP | TECH)',
      status: 'string (IN_BAY | ON_TRUCK | MISSING)',
      last_assigned_tech: 'string',
      last_assigned_unit: 'string'
    }],
    shop_policy: {
      tier: 'string (LITE | PRO | PLATINUM)',
      enable_price_audit: 'boolean',
      enable_bay_custody: 'boolean',
      autoLockEnabled: 'boolean',
      onboarding_complete: 'boolean',
      onboarding_path: 'string (MARGIN | DIAGNOSE | MIGRATE)',
      onboarding_completed_at: 'ISOString|null',
      featureLevels: {
        hardware: 'number',
        leaderboard: 'number'
      },
      active_modules: 'array'
    },
    vendor_directory: 'array',
    customers_directory: 'array',
    available_blocks: 'array',

    margin_config: {
      slabs: [{ label: 'string', maxCost: 'number|null', multiplier: 'number' }],
      tierDiscounts: { FLEET: 'number', LEGACY: 'number', FF: 'number' }
    },

    external_connections: {
      quickbooks: { connected: 'boolean', realmId: 'string|null', companyName: 'string|null', connectedAt: 'ISOString|null', lastSync: 'ISOString|null' },
      csv: { lastImport: 'ISOString|null', recordsImported: 'number' }
    },

    margin_change_log: [{
      id: 'string',
      changed_by: 'user_id',
      changed_at: 'ISOString',
      field_changed: 'string',
      category: 'string (SLAB | LABOR | TIER_OFFSET | OVERHEAD)',
      old_value: 'any',
      new_value: 'any',
      reason: 'string'
    }],

    overhead_config: {
      monthly: {
        rent: 'number',
        electric: 'number',
        fuel: 'number',
        insurance: 'number',
        maintenance: 'number',
        other: [{ label: 'string', amount: 'number' }]
      },
      last_updated: 'ISOString',
      updated_by: 'user_id'
    },

    invoice_history: [{
      id: 'string',
      qboId: 'string',
      customerId: 'string',
      customerName: 'string',
      date: 'string',
      total: 'number',
      balance: 'number',
      paid: 'number',
      status: 'string (PAID | UNPAID | PARTIAL)',
      lineItems: 'array',
      source: 'string'
    }]
  },
  
  syncQueue: [],

  // ── Shop identity ────────────────────────────────────────────────────────────
  getShopId: () => {
    if (memoryStore._shopId) return memoryStore._shopId;
    if (isWeb) return localStorage.getItem('IGNITION_SHOP_ID');
    return null;
  },

  setShopId: (id) => {
    memoryStore._shopId = id;
    if (isWeb) {
      localStorage.setItem('IGNITION_SHOP_ID', id);
    } else if (AsyncStorage) {
      AsyncStorage.setItem('IGNITION_SHOP_ID', id)
        .catch(e => console.warn('[DataBridge] setShopId persist failed:', e));
    }
  },

  getShopName: () => {
    if (memoryStore._shopName) return memoryStore._shopName;
    if (isWeb) return localStorage.getItem('IGNITION_SHOP_NAME');
    return null;
  },

  setShopName: (name) => {
    memoryStore._shopName = name;
    if (isWeb) localStorage.setItem('IGNITION_SHOP_NAME', name);
  },

  /**
   * CLOUD SYNC: Pulls jobs from Supabase, falls back to FastAPI, then local cache.
   */
  pullCloudSync: async () => {
    const shopId = DataBridge.getShopId();
    if (shopId) {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          DataBridge.save('active_jobs', data, true);
          return data;
        }
      } catch (err) {
        console.warn('[DataBridge] Supabase pull failed, trying FastAPI fallback.', err);
      }
    }
    // FastAPI fallback (local dev / offline)
    try {
      const res = await fetch(`${API_URL}/api/jobs`, { cache: 'no-store' });
      if (res.ok) {
        const serverJobs = await res.json();
        DataBridge.save('active_jobs', serverJobs, true);
        return serverJobs;
      }
    } catch (err) {
      console.error('[DataBridge] Cloud sync failed — returning local cache.', err);
    }
    return DataBridge.load('active_jobs');
  },

  pushCloudSync: async (jobs) => {
    const shopId = DataBridge.getShopId();
    if (shopId && Array.isArray(jobs)) {
      try {
        // Upsert each job — Supabase handles insert vs update by PK
        const rows = jobs.map(j => ({ ...j, shop_id: shopId }));
        await supabase.from('jobs').upsert(rows, { onConflict: 'id' });
        return;
      } catch (err) {
        console.warn('[DataBridge] Supabase push failed, trying FastAPI fallback.', err);
      }
    }
    // FastAPI fallback
    try {
      await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobs)
      });
    } catch (err) {
      console.error('[DataBridge] Push failed — job queued for retry.', err);
    }
  },

  /**
   * DB: Async Supabase methods for all core tables.
   * Usage: await DataBridge.db.jobs.getAll()
   */
  db: {
    _shopId: () => DataBridge.getShopId(),

    jobs: {
      getAll:  async ()      => supabase.from('jobs').select('*').eq('shop_id', DataBridge.getShopId()).order('created_at', { ascending: false }),
      getOne:  async (id)    => supabase.from('jobs').select('*').eq('id', id).single(),
      save:    async (job)   => supabase.from('jobs').upsert({ ...job, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
      remove:  async (id)    => supabase.from('jobs').delete().eq('id', id),
    },

    shop: {
      get:     async ()      => supabase.from('shops').select('*').eq('id', DataBridge.getShopId()).single(),
      save:    async (data)  => supabase.from('shops').upsert({ ...data, id: DataBridge.getShopId() }, { onConflict: 'id' }),
      create:  async (data)  => {
        const { data: shop, error } = await supabase.from('shops').insert(data).select().single();
        if (!error && shop) DataBridge.setShopId(shop.id);
        return { data: shop, error };
      },
    },

    users: {
      getAll:  async ()      => supabase.from('users').select('*').eq('shop_id', DataBridge.getShopId()),
      save:    async (user)  => supabase.from('users').upsert({ ...user, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
      remove:  async (id)    => supabase.from('users').delete().eq('id', id),
    },

    purchaseOrders: {
      getAll:  async ()      => supabase.from('purchase_orders').select('*').eq('shop_id', DataBridge.getShopId()).order('created_at', { ascending: false }),
      getOne:  async (id)    => supabase.from('purchase_orders').select('*').eq('id', id).single(),
      save:    async (po)    => supabase.from('purchase_orders').upsert({ ...po, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
      updateStatus: async (id, status, extra = {}) =>
        supabase.from('purchase_orders').update({ status, ...extra, updated_at: new Date().toISOString() }).eq('id', id),
    },

    tools: {
      getAll:  async ()      => supabase.from('tools').select('*').eq('shop_id', DataBridge.getShopId()),
      getOne:  async (id)    => supabase.from('tools').select('*').eq('id', id).single(),
      save:    async (tool)  => supabase.from('tools').upsert({ ...tool, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
      updateStatus: async (id, status) =>
        supabase.from('tools').update({ status }).eq('id', id),
    },

    pmi: {
      getForTool: async (toolId) => supabase.from('pmi_schedules').select('*').eq('tool_id', toolId).single(),
      save:    async (schedule)  => supabase.from('pmi_schedules').upsert({ ...schedule, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
    },

    aiUsage: {
      getForShop: async (days = 30) => {
        const since = new Date(Date.now() - days * 86400000).toISOString();
        return supabase.from('ai_usage').select('*')
          .eq('shop_id', DataBridge.getShopId())
          .gte('created_at', since)
          .order('created_at', { ascending: false });
      },
      getCostSummary: async () => {
        const { data } = await supabase.from('ai_usage').select('provider, cost_usd')
          .eq('shop_id', DataBridge.getShopId());
        if (!data) return {};
        return data.reduce((acc, row) => {
          acc[row.provider] = (acc[row.provider] || 0) + Number(row.cost_usd);
          return acc;
        }, {});
      },
    },
  },

  /**
   * OFFLINE & MIDDLEMAN PROTECTION
   * Safely attempts an API call; if it fails, it queues for later.
   */
  smartSync: async (action, data) => {
    if (navigator.onLine) {
      try {
        console.log(`[DataBridge] Attempting live sync for: ${action}`);
        // Simulate API call to Samsara/Geotab
        // await api.post(action, data); 
        return { success: true };
      } catch (e) {
        console.warn("[DataBridge] Live sync failed, falling back to local memory.", e);
      }
    } else {
      DataBridge.queueAction(action, data);
    }
  },

  queueAction: (action, data) => {
    console.warn(`[DataBridge] OFFLINE: Queuing action ${action} for background sync.`);
    DataBridge.syncQueue.push({ action, data, timestamp: Date.now() });
    if (isWeb) {
      localStorage.setItem('IGNITION_SYNC_QUEUE', JSON.stringify(DataBridge.syncQueue));
    }
  },

  /**
   * SAVE: Persists data with automated metadata and trial tracking.
   */
  save: (key, data, skipPush = false) => {
    try {
      let payload;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
         payload = {
           ...data,
           _metadata: {
             lastUpdated: new Date().toISOString(),
             appVersion: "1.0.0",
             trialStartedAt: data.trialActive ? (data.trialStartedAt || new Date().toISOString()) : null
           }
         };
      } else {
         payload = data; // store arrays or nulls directly
      }

      // 1. Save to universal memory store
      memoryStore[key] = payload;

      // 2. Persist to platform storage
      if (isWeb) {
        const existingData = JSON.parse(localStorage.getItem(DataBridge.storageKey)) || {};
        existingData[key] = payload;
        localStorage.setItem(DataBridge.storageKey, JSON.stringify(existingData));
      } else if (AsyncStorage) {
        // Fire-and-forget — memoryStore is the source of truth, AsyncStorage is the restart backup
        AsyncStorage.getItem(DataBridge.storageKey)
          .then(raw => {
            const existingData = raw ? JSON.parse(raw) : {};
            existingData[key] = payload;
            return AsyncStorage.setItem(DataBridge.storageKey, JSON.stringify(existingData));
          })
          .catch(e => console.warn('[DataBridge] AsyncStorage write failed:', e));
      }
      
      // If we are saving active jobs, mirror it to the Python Cloud Database
      if (key === 'active_jobs' && !skipPush) {
        DataBridge.pushCloudSync(payload);
      }
      
      console.log(`[DataBridge] SYNC SUCCESS: ${key} committed.`);
      return true;
    } catch (error) {
      console.error(`[DataBridge] CRITICAL SAVE ERROR:`, error);
      return false;
    }
  },

  /**
   * LOAD: Retrieves a specific module or data point.
   */
  load: (key) => {
    try {
      // 1. Always check hot memory first (fastest, universal)
      if (memoryStore[key] !== undefined) {
        return memoryStore[key];
      }
      
      // 2. Fallback to platform storage (sync on web, async hydration on mobile)
      if (isWeb) {
        const store = JSON.parse(localStorage.getItem(DataBridge.storageKey));
        if (store && store[key] !== undefined) {
          memoryStore[key] = store[key];
          return store[key];
        }
      }
      // Mobile: memoryStore should already be hydrated via DataBridge.hydrate() at app start.
      // If we reach here on mobile, the key genuinely doesn't exist yet.
      return null;
    } catch (error) {
      console.error(`[DataBridge] LOAD ERROR for ${key}:`, error);
      return null;
    }
  },

  /**
   * HYDRATE: Call once at mobile app startup to load AsyncStorage into memoryStore.
   * On web this is a no-op — localStorage is read synchronously on demand.
   */
  hydrate: async () => {
    if (isWeb || !AsyncStorage) return;
    try {
      const [raw, shopId] = await Promise.all([
        AsyncStorage.getItem(DataBridge.storageKey),
        AsyncStorage.getItem('IGNITION_SHOP_ID'),
      ]);
      if (raw) {
        const stored = JSON.parse(raw);
        Object.assign(memoryStore, stored);
        console.log('[DataBridge] Mobile hydration complete —', Object.keys(stored).length, 'keys loaded');
      }
      if (shopId) {
        memoryStore._shopId = shopId;
        console.log('[DataBridge] Shop ID restored:', shopId);
      }
    } catch (e) {
      console.warn('[DataBridge] Hydration failed:', e);
    }
  },

  /**
   * TRACK: Fire-and-forget usage event to Supabase feature_events table.
   * Lets TRACE monitor which modules/actions are used per shop without blocking the UI.
   */
  logError: (errorType, message, stack = null, metadata = {}) => {
    const shopId = DataBridge.getShopId();
    supabase.from('error_events').insert({
      shop_id:    shopId || null,
      error_type: errorType,
      message:    String(message || '').slice(0, 500),
      stack:      stack ? String(stack).slice(0, 2000) : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
      metadata,
    }).then(({ error }) => {
      if (error) console.warn('[DataBridge] logError failed:', error.message);
    });
  },

  trackEvent: (module, action, metadata = {}) => {
    const shopId = DataBridge.getShopId();
    const user   = DataBridge.load('current_user') || {};
    if (!shopId) return;
    supabase.from('feature_events').insert({
      shop_id:   shopId,
      user_role: user.role || 'UNKNOWN',
      module,
      action,
      metadata,
    }).then(({ error }) => {
      if (error) console.warn('[DataBridge] trackEvent failed:', error.message);
    });
  },

  /**
   * SHOP_TRIAL: Returns the shop-level 14-day trial status.
   * day 0–6: active, day 7: nudge, day 12: savings report, day 14: warning, day 15+: blur, day 30+: archive
   */
  getShopTrialStatus: () => {
    const info = DataBridge.load('shop_info') || {};
    const policy = DataBridge.load('shop_policy') || {};

    // Paid shops skip the trial gate entirely
    if (policy.tier && policy.tier !== 'TRIAL') {
      return { day: 0, daysRemaining: 999, isActive: true, isWarning: false, isBlurred: false, isArchived: false, isPaid: true };
    }

    const start = info.trial_started_at ? new Date(info.trial_started_at) : null;
    if (!start) {
      return { day: 0, daysRemaining: 14, isActive: true, isWarning: false, isBlurred: false, isArchived: false, isPaid: false };
    }

    const day = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
    return {
      day,
      daysRemaining: Math.max(0, 14 - day),
      isActive:   day < 14,
      isWarning:  day >= 12 && day < 15,
      isBlurred:  day >= 15 && day < 30,
      isArchived: day >= 30,
      isPaid:     false,
      showNudge:  day >= 7  && day < 12,
      showReport: day >= 12 && day < 15,
    };
  },

  /**
   * CHECK_TRIAL: Logic for the "Blind Spot" / Blur feature.
   * Returns: { isExpired: boolean, daysRemaining: number }
   */
  checkTrialStatus: (moduleKey) => {
    const data = DataBridge.load('system_subscriptions');
    if (!data || !data[moduleKey] || !data[moduleKey].trialStartedAt) {
      return { isExpired: false, daysRemaining: 30 };
    }

    const start = new Date(data[moduleKey].trialStartedAt);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const limit = 30; // Your 30-day "In Deep" strategy
    return {
      isExpired: diffDays > limit,
      daysRemaining: Math.max(0, limit - diffDays)
    };
  },

  /**
   * CLEAR_ALL: Factory reset for testing trials.
   */
  factoryReset: () => {
    memoryStore = {};
    if (isWeb) {
      localStorage.removeItem(DataBridge.storageKey);
      window.location.reload();
    } else {
      console.warn("[DataBridge] Factory Reset triggered on Mobile. UI must handle refresh.");
    }
  },

  // Wipes shop registration + onboarding flag only — job/customer data is preserved.
  resetOnboarding: () => {
    if (isWeb) {
      const raw = localStorage.getItem(DataBridge.storageKey);
      const data = raw ? JSON.parse(raw) : {};
      delete data.shop_policy;
      delete data.shop_info;
      delete data.current_user;
      delete data.user_profiles;
      localStorage.removeItem('IGNITION_SHOP_ID');
      localStorage.setItem(DataBridge.storageKey, JSON.stringify(data));
      window.location.reload();
    }
  },

  // Shifts trial_started_at so the app behaves as if it's currently day N.
  simulateTrialDay: (day) => {
    const info = DataBridge.load('shop_info') || {};
    const fakeStart = new Date(Date.now() - day * 24 * 60 * 60 * 1000).toISOString();
    DataBridge.save('shop_info', { ...info, trial_started_at: fakeStart });
    if (isWeb) window.location.reload();
  },

  /**
   * PRICING: Unified margin config (replaces prot_matrix as single source of truth).
   * MarginEngine reads this directly; these methods are for saving/logging changes.
   */
  getMarginConfig: () => {
    return DataBridge.load('margin_config') || {
      slabs: [
        { label: 'Consumables', maxCost: 50,   multiplier: 4.0  },
        { label: 'Mid-Range',   maxCost: 200,  multiplier: 2.0  },
        { label: 'Heavy',       maxCost: 1000, multiplier: 1.5  },
        { label: 'Major',       maxCost: null, multiplier: 1.25 },
      ],
      tierDiscounts: { FLEET: 10, LEGACY: 20, FF: 5 },
    };
  },

  setMarginConfig: (newConfig, userId) => {
    const oldConfig = DataBridge.load('margin_config') || {};
    DataBridge.save('margin_config', newConfig);

    // Log each changed slab multiplier
    const oldSlabs = oldConfig.slabs || [];
    (newConfig.slabs || []).forEach((slab, i) => {
      const old = oldSlabs[i];
      if (!old || old.multiplier !== slab.multiplier) {
        DataBridge.logMarginChange({
          field_changed: `slabs[${i}].multiplier (${slab.label})`,
          category: 'SLAB',
          old_value: old?.multiplier ?? null,
          new_value: slab.multiplier,
          changed_by: userId || 'SYSTEM',
        });
      }
      if (!old || old.maxCost !== slab.maxCost) {
        DataBridge.logMarginChange({
          field_changed: `slabs[${i}].maxCost (${slab.label})`,
          category: 'SLAB',
          old_value: old?.maxCost ?? null,
          new_value: slab.maxCost,
          changed_by: userId || 'SYSTEM',
        });
      }
    });

    // Log changed tier discounts
    const oldDiscounts = oldConfig.tierDiscounts || {};
    Object.entries(newConfig.tierDiscounts || {}).forEach(([tier, val]) => {
      if (oldDiscounts[tier] !== val) {
        DataBridge.logMarginChange({
          field_changed: `tierDiscounts.${tier}`,
          category: 'TIER_OFFSET',
          old_value: oldDiscounts[tier] ?? null,
          new_value: val,
          changed_by: userId || 'SYSTEM',
        });
      }
    });
  },

  // HONEST DEBT 🔴 (C): getProtMatrix/getActiveMargin/calculateRetail deprecated.
  //   Uses prot_matrix percent-of-cost model — DIFFERENT from slab model; produces different prices.
  //   Callers: IgnitionCipher.jsx (lines 35,39 — price will change at migration; accepted),
  //            OnboardingWizard.jsx (line 435 — demo path only),
  //            DataBridge.recordTransaction (line ~907 — margin_at_time stamp).
  //   Replacement: packages/shared/src/business-logic/MarginEngine.ts calculateRetail()
  //   Migration checklist: docs/audits/margin-engine-migration-checklist-2026-06-10.md
  //   Do not extend. Retire after all C callers migrate.
  /**
   * PRICING: Legacy prot_matrix kept for backward compatibility with IgnitionCipher.
   * New code should use MarginEngine directly.
   */
  getProtMatrix: () => {
    return DataBridge.load('prot_matrix') || { anchor: 40, fleetOffset: 10, legacyOffset: 20, ffFlat: 5 };
  },
  getActiveMargin: (tier) => {
    const matrix = DataBridge.getProtMatrix();
    switch(tier) {
      case 'FLEET': return matrix.anchor - matrix.fleetOffset;
      case 'LEGACY': return matrix.anchor - matrix.legacyOffset;
      case 'FF': return matrix.ffFlat;
      default: return matrix.anchor;
    }
  },
  calculateRetail: (cost, margin) => {
    return (cost / (1 - (margin / 100))).toFixed(2);
  },

  /**
   * UNIVERSAL MODULE REGISTRY
   */
  getRegistry: () => {
    return DataBridge.load('system_registry') || {
      intake: { id: 'intake', label: 'Intake', color: '#3b82f6', active: true, cost: 49, trialDate: '2026-04-01' },
      queue: { id: 'queue', label: 'Queue', color: '#6366f1', active: true, cost: 29, trialDate: '2026-04-01' },
      vin: { id: 'vin', label: 'VIN Decode', color: '#0ea5e9', active: true, cost: 99, trialDate: '2026-04-01' },
      voice: { id: 'voice', label: 'Scribe AI', color: '#ef4444', active: true, cost: 149, trialDate: '2026-04-15' },
      estimates: { id: 'estimates', label: 'Estimates', color: '#10b981', active: true, cost: 49, trialDate: '2026-04-20' },
      parts: { id: 'parts', label: 'Manifest', color: '#f59e0b', active: true, cost: 79, trialDate: '2026-04-01' },
      procure: { id: 'procure', label: 'Procure', color: '#ec4899', active: true, cost: 129, trialDate: '2026-04-10' },
      tools: { id: 'tools', label: 'Tools', color: '#8b5cf6', active: true, cost: 19, trialDate: '2026-04-01' },
      admin: { id: 'admin', label: 'Admin', color: '#64748b', active: true, cost: 0, trialDate: '2026-04-01' },
      crm: { id: 'crm', label: 'CRM', color: '#818cf8', active: true, cost: 49, trialDate: '2026-04-01' },
      fleet: { id: 'fleet', label: 'Fleet', color: '#06b6d4', active: true, cost: 199, trialDate: '2026-04-12' },
      inv: { id: 'inv', label: 'Stock AI', color: '#6366f1', active: true, cost: 89, trialDate: '2026-04-01' },
      kiosk: { id: 'kiosk', label: 'Kiosk', color: '#10b981', active: true, cost: 0, trialDate: '2026-04-01' },
    };
  },

  // ── PIN Auth (Supabase-based, cross-device) ──────────────────────────────────

  /**
   * Hash a PIN for storage and lookup.
   * Uses SHA-256 salted with shopId so the same PIN at two shops produces
   * different hashes — prevents cross-shop collisions.
   */
  hashPin: async (shopId, pin) => {
    const raw = new TextEncoder().encode(`${shopId}:${pin}`);
    const buf = await crypto.subtle.digest('SHA-256', raw);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /**
   * Register (or update last_seen on) the current browser as a member_devices row.
   * Called automatically on every successful login so the admin's Devices tab
   * populates without any manual step from the tech.
   */
  autoEnrollDevice: async (memberId, shopId) => {
    if (!isWeb) return;
    let fingerprint = localStorage.getItem('device_fingerprint');
    if (!fingerprint) {
      fingerprint = crypto.randomUUID();
      localStorage.setItem('device_fingerprint', fingerprint);
    }
    const { data: existing } = await supabase
      .from('member_devices')
      .select('id')
      .eq('member_id', memberId)
      .eq('device_fingerprint', fingerprint)
      .maybeSingle();

    const now = new Date().toISOString();
    if (!existing) {
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      const label = ua.includes('iPhone') ? 'iPhone'
        : ua.includes('iPad')    ? 'iPad'
        : ua.includes('Android') ? 'Android Device'
        : ua.includes('Mac')     ? 'Mac'
        : 'Browser';
      await supabase.from('member_devices').insert({
        member_id:          memberId,
        shop_id:            shopId,
        device_fingerprint: fingerprint,
        device_label:       label,
        is_active:          true,
        last_seen:          now,
      });
    } else {
      await supabase.from('member_devices')
        .update({ last_seen: now })
        .eq('id', existing.id);
    }
  },

  /**
   * Verify a PIN against Supabase shop_members.pin_hash.
   * Returns the member session on success, null on failure.
   * Async — must be awaited everywhere it is called.
   */
  authenticate: async (pin) => {
    const shopId = DataBridge.getShopId();
    if (!shopId) return null;

    const pinHash = await DataBridge.hashPin(shopId, pin);

    const { data: member } = await supabase
      .from('shop_members')
      .select('*')
      .eq('shop_id', shopId)
      .eq('pin_hash', pinHash)
      .eq('active', true)
      .maybeSingle();

    if (!member) return null;

    await DataBridge.autoEnrollDevice(member.id, shopId);

    const session = {
      id:          member.id,
      member_id:   member.id,
      shop_id:     shopId,
      name:        member.name,
      role:        member.role,
      sub_role:    member.sub_role || null,
      permissions: member.permissions || [],
      allowed: (member.permissions || [])
        .filter(p => p.startsWith('view_'))
        .map(p => p.replace('view_', '')),
      cached_at: new Date().toISOString(),
    };
    DataBridge.save('current_user', session);
    return session;
  },

  /**
   * SECURITY & LABOR REGISTRY
   */
  getProfiles: () => {
    const saved = DataBridge.load('user_profiles');
    if (saved && Object.keys(saved).length > 0) return saved;
    // Default seed profiles — overwritten after onboarding creates the owner account
    return {
      '1111': { id: '1111', name: 'A. MANAGER', role: 'ADMIN', allowed: ['intake', 'queue', 'vin', 'voice', 'estimates', 'parts', 'procure', 'tools', 'inv', 'admin', 'fleet', 'kiosk'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] }, hasSignedWaiver: true, permissions: ["ADMIN", "TECH", "PRICING_AUTHORITY"] },
      '1234': { id: '1234', name: 'T. OBRIEN', role: 'TECHNICIAN', allowed: ['queue', 'parts', 'tools'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model', 'Displacement (L)'] }, hasSignedWaiver: false, permissions: ["TECH"] },
      '2222': { id: '2222', name: 'S. WRITER', role: 'SERVICE', allowed: ['intake', 'queue', 'vin', 'estimates', 'parts', 'procure', 'kiosk'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] }, hasSignedWaiver: true, permissions: ["TECH"] },
      '3333': { id: '3333', name: 'L. PILOT', role: 'DEVELOPER', allowed: ['intake', 'queue', 'vin', 'voice', 'estimates', 'parts', 'procure', 'tools', 'inv', 'admin', 'fleet', 'kiosk'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model', 'VIN'] }, hasSignedWaiver: true, permissions: ["ADMIN", "TECH", "PRICING_AUTHORITY"] }
    };
  },

  logout: () => {
    DataBridge.save('current_user', null);
  },

  getSystemRates: () => {
    const config = DataBridge.load('system_config');
    if (config && config.laborRates) {
      return config.laborRates;
    }
    // Master Fallback Baseline
    return { BASE: 165.00, DIAGNOSTIC: 195.00, MOBILE: 225.00, MARKUP_ON_SUBLET: 20 };
  },

  setSystemRates: (newRates, adminId) => {
    const config = DataBridge.load('system_config') || {};
    const oldRates = config.laborRates || DataBridge.getSystemRates();
    config.laborRates = newRates;
    DataBridge.save('system_config', config);

    // Write to admin audit log
    const ledger = DataBridge.load('admin_audit_log') || [];
    ledger.push({ action: 'UPDATE_LABOR_RATES', newRates, adminId: adminId || 'SYSTEM', timestamp: Date.now() });
    DataBridge.save('admin_audit_log', ledger);

    // Write to margin_change_log for analytics
    Object.keys(newRates).forEach(field => {
      if (oldRates[field] !== newRates[field]) {
        DataBridge.logMarginChange({
          field_changed: `laborRates.${field}`,
          category: 'LABOR',
          old_value: oldRates[field],
          new_value: newRates[field],
          changed_by: adminId || 'SYSTEM',
        });
      }
    });
  },

  getMarginMatrix: () => {
    const config = DataBridge.load('system_config') || {};
    return config.marginMatrix || { defaultMarkup: 1.25, slabs: [] };
  },

  setMarginMatrix: (matrix, adminId) => {
    const config = DataBridge.load('system_config') || {};
    config.marginMatrix = matrix;
    DataBridge.save('system_config', config);
    const ledger = DataBridge.load('admin_audit_log') || [];
    ledger.push({ action: 'UPDATE_MARGIN_MATRIX', matrix, adminId: adminId || 'SYSTEM', timestamp: Date.now() });
    DataBridge.save('admin_audit_log', ledger);
  },

  getOperationalCosts: () => {
    const config = DataBridge.load('system_config') || {};
    return config.operationalCosts || { rent: 0, electric: 0, fuel: 0, maintenance: 0 };
  },

  setOperationalCosts: (costs, adminId) => {
    const config = DataBridge.load('system_config') || {};
    config.operationalCosts = costs;
    DataBridge.save('system_config', config);
    const ledger = DataBridge.load('admin_audit_log') || [];
    ledger.push({ action: 'UPDATE_OPERATIONAL_COSTS', costs, adminId: adminId || 'SYSTEM', timestamp: Date.now() });
    DataBridge.save('admin_audit_log', ledger);
  },

  /**
   * LOG_MARGIN_CHANGE: Appends a timestamped entry to margin_change_log for analytics.
   */
  logMarginChange: ({ field_changed, category, old_value, new_value, changed_by, reason = '' }) => {
    const log = DataBridge.load('margin_change_log') || [];
    log.push({
      id: `MCL-${Date.now()}`,
      changed_by: changed_by || 'SYSTEM',
      changed_at: new Date().toISOString(),
      field_changed,
      category,
      old_value,
      new_value,
      reason,
    });
    DataBridge.save('margin_change_log', log);
  },

  /**
   * GET/SET OVERHEAD CONFIG
   */
  getOverhead: () => {
    return DataBridge.load('overhead_config') || {
      monthly: { rent: 0, electric: 0, fuel: 0, insurance: 0, maintenance: 0, other: [] },
      last_updated: null,
      updated_by: null,
    };
  },

  setOverhead: (monthly, userId) => {
    const current = DataBridge.getOverhead();
    DataBridge.save('overhead_config', {
      monthly,
      last_updated: new Date().toISOString(),
      updated_by: userId || 'SYSTEM',
    });
    DataBridge.logMarginChange({
      field_changed: 'overhead_config.monthly',
      category: 'OVERHEAD',
      old_value: current.monthly,
      new_value: monthly,
      changed_by: userId || 'SYSTEM',
    });
  },

  /**
   * RECORD TRANSACTION: Stamps each sale with margin metadata for quarterly analytics.
   */
  recordTransaction: (tx) => {
    const rates = DataBridge.getSystemRates();
    const margin = DataBridge.getActiveMargin(tx.tier || 'STANDARD');
    const d = new Date();
    const quarter = `Q${Math.ceil((d.getMonth() + 1) / 3)}-${d.getFullYear()}`;

    const enriched = {
      ...tx,
      margin_at_time: margin,
      labor_rate_at_time: rates.BASE,
      quarter,
      timestamp: tx.timestamp || Date.now(),
    };

    const history = DataBridge.load('transaction_history') || [];
    history.push(enriched);
    DataBridge.save('transaction_history', history);
    return enriched;
  },

  /**
   * CUSTOMER DIRECTORY & CRM
   */
  getCustomers: () => {
    return DataBridge.load('customers_directory') || [
      // Contract / Fleet Customer
      { id: 'C-1001', name: 'Texas Star Logistics', phone: '512-555-0199', email: 'dispatch@txstar.com', address: '100 Fleet Way, Austin, TX', type: 'CONTRACT', contractNum: 'TX-FLT-882', tier: 'FLEET', vehicles: [{ year: '2019', make: 'Freightliner', model: 'Cascadia', vin: '1FUJGL...' }] },
      // Friends & Family Customer
      { id: 'C-1002', name: 'Mike (Buddy)', phone: '512-555-8822', email: 'mike.w@email.com', address: '450 Local Ln, Leander, TX', type: 'PERSONAL', tier: 'FF', vehicles: [{ year: '2006', make: 'Toyota', model: 'RAV4', vin: 'YV1672...' }] },
      // Standard Repeat Customer
      { id: 'C-1003', name: 'Sarah Miller', phone: '512-555-3344', email: 'sarah.m@email.com', address: '12 Oak St, Cedar Park, TX', type: 'PERSONAL', tier: 'STANDARD', vehicles: [{ year: '2015', make: 'Ford', model: 'Explorer', vin: '1FMFK...' }] }
    ];
  },
  
  addCustomer: (customer) => {
    const customers = DataBridge.getCustomers();
    // True sync push could be handled here if wired to the Python API
    DataBridge.save('customers_directory', [...customers, customer]);
  },

  /**
   * VENDOR DIRECTORY
   */
  getVendors: () => {
    return DataBridge.load('vendor_directory') || [
      { id: 'V-001', name: 'AutoZone Commercial', address: '123 Main St, Leander, TX 78641', phone: '512-555-0101', weblink: 'https://autozonepro.com', accountNum: 'AZ-8832-TX', priority: 1 },
      { id: 'V-002', name: 'NAPA Auto Parts', address: '456 Gear Blvd, Cedar Park, TX 78613', phone: '512-555-0202', weblink: 'https://napaonline.com', accountNum: 'NA-10029', priority: 2 },
      { id: 'V-003', name: 'FleetPride', address: '789 Diesel Way, North Austin, TX 78728', phone: '512-555-0303', weblink: 'https://fleetpride.com', accountNum: 'FP-TX-554', priority: 3 }
    ];
  },
  
  addVendor: (vendor) => {
    const vendors = DataBridge.getVendors();
    DataBridge.save('vendor_directory', [...vendors, vendor]);
  },
  
  getLaborGuide: () => {
    return DataBridge.load('labor_guide') || {
      'OIL_CHANGE': { job: 'Standard Oil Change', hours: 0.5 },
      'TIRE_ROTATION': { job: 'Tire Rotation & Balance', hours: 1.0 },
      'BRAKE_INSPECTION': { job: 'Brake System Inspection', hours: 1.2 },
      'TURBO_REPLACEMENT': { job: 'Turbocharger R&R', hours: 3.5 },
      'DPF_CLEAN': { job: 'DPF System Clean & Test', hours: 4.0 },
    };
  },

  getJobs: () => {
    return DataBridge.load('active_jobs') || [];
  },

  getAuditHistory: () => {
    return DataBridge.load('invoice_audits') || [];
  },

  saveAuditResult: (result) => {
    const history = DataBridge.load('invoice_audits') || [];
    history.unshift({ ...result, id: Date.now(), auditedAt: new Date().toISOString() });
    if (history.length > 100) history.splice(100);
    DataBridge.save('invoice_audits', history);
  },

  getFleetUnits: () => {
    return DataBridge.load('fleet_units') || [];
  },

  saveFleetUnit: (unit) => {
    const units = DataBridge.load('fleet_units') || [];
    const idx = units.findIndex(u => u.id === unit.id);
    if (idx >= 0) units[idx] = { ...units[idx], ...unit };
    else units.push(unit);
    DataBridge.save('fleet_units', units);
  },

  // ── PMI (Preventive Maintenance) ──────────────────────────────────────────

  getPMIAssets: () => {
    const stored = DataBridge.load('pmi_assets') || [];
    const storedIds = new Set(stored.map(a => a.id));
    // Auto-surface specialized gear from active jobs
    const jobs = DataBridge.load('active_jobs') || [];
    const jobAssets = [];
    jobs.forEach(j => {
      (j.inventory?.specialized || []).forEach(item => {
        if (!storedIds.has(item.id)) {
          jobAssets.push({
            id: item.id,
            name: `${item.name}${j.unit ? ` (${j.unit})` : ''}`,
            type: 'VEHICLE_EQUIPMENT',
            managedBy: 'SHOP',
            telematicsRisk: item.health === 'RED' ? 85 : item.health === 'YELLOW' ? 45 : 10,
            lastPMI: null,
            pmiDue: null,
            savingsAvoided: 0,
            source: 'JOB',
          });
        }
      });
    });
    return [...stored, ...jobAssets];
  },

  savePMIAsset: (asset) => {
    const assets = DataBridge.load('pmi_assets') || [];
    const idx = assets.findIndex(a => a.id === asset.id);
    if (idx >= 0) assets[idx] = { ...assets[idx], ...asset };
    else assets.push(asset);
    DataBridge.save('pmi_assets', assets);
  },

  getPMISchedule: (assetId) => {
    const all = DataBridge.load('pmi_schedules') || {};
    return all[assetId] || null;
  },

  savePMISchedule: (assetId, schedule) => {
    const all = DataBridge.load('pmi_schedules') || {};
    all[assetId] = { ...schedule, savedAt: new Date().toISOString() };
    DataBridge.save('pmi_schedules', all);
  },

  getPMILogs: (assetId) => {
    const all = DataBridge.load('pmi_logs') || {};
    return all[assetId] || [];
  },

  logPMIInspection: (assetId, entry) => {
    const all = DataBridge.load('pmi_logs') || {};
    if (!all[assetId]) all[assetId] = [];
    all[assetId].unshift({ ...entry, id: Date.now(), loggedAt: new Date().toISOString() });
    DataBridge.save('pmi_logs', all);
  },

  getSystemRoles: () => {
    const config = DataBridge.load('system_config');
    if (config && config.roles) {
      return config.roles;
    }
    // Hardcoded Master Fallback
    return {
      ADMIN: ["view_omni", "view_hub", "view_flux", "view_predictive", "view_cipher", "view_stok", "view_proc", "view_prot", "view_port", "view_crm", "view_marketplace", "edit_margins", "manage_users", "approve_payroll"],
      TECH: ["view_kosk", "view_cipher", "view_hub", "scan_parts", "update_flux"],
      CUSTOMER: ["view_port", "sign_estimates", "pay_invoice"]
    };
  }
};

export default DataBridge;
