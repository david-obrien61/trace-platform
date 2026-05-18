/**
 * FILE: useDataBridge.js
 * PLATFORM: Universal (React Hooks)
 * PURPOSE: State engine managing active jobs, module registry, global system lockouts, and offline/sync logic.
 * DEPENDENCIES: react
 */

import { useState } from 'react';

export const useDataBridge = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [jobs, setJobs] = useState([
    { jobId: 'JOB-999', name: 'PRE-FLIGHT TEST', year: '1999', make: 'Chevy', model: 'Suburban', status: 'READY' }
  ]);

  const [registry, setRegistry] = useState({
    intake: { id: 'intake', label: 'Intake', color: '#3b82f6', active: true, cost: 49, trialDate: '2026-04-01' },
    queue: { id: 'queue', label: 'Queue', color: '#6366f1', active: true, cost: 29, trialDate: '2026-04-01' },
    vin: { id: 'vin', label: 'VIN Decode', color: '#0ea5e9', active: true, cost: 99, trialDate: '2026-04-01' },
    voice: { id: 'voice', label: 'Scribe AI', color: '#ef4444', active: true, cost: 149, trialDate: '2026-04-15' },
    estimates: { id: 'estimates', label: 'Estimates', color: '#10b981', active: true, cost: 49, trialDate: '2026-04-20' },
    parts: { id: 'parts', label: 'Manifest', color: '#f59e0b', active: true, cost: 79, trialDate: '2026-04-01' },
    procure: { id: 'procure', label: 'Procure', color: '#ec4899', active: true, cost: 129, trialDate: '2026-04-10' },
    tools: { id: 'tools', label: 'Tools', color: '#8b5cf6', active: true, cost: 19, trialDate: '2026-04-01' },
    admin: { id: 'admin', label: 'Admin', color: '#64748b', active: true, cost: 0, trialDate: '2026-04-01' },
    fleet: { id: 'fleet', label: 'Fleet', color: '#06b6d4', active: true, cost: 199, trialDate: '2026-04-12' },
    inv: { id: 'inv', label: 'Stock AI', color: '#6366f1', active: true, cost: 89, trialDate: '2026-04-01' },
  });

  const addJob = (newJob) => setJobs(prev => [...prev, { ...newJob, status: 'READY' }]);

  const updateJob = (jobId, updatedData) => {
    setJobs(prev => prev.map(job => 
      job.jobId === jobId ? { ...job, ...updatedData } : job
    ));
  };

  const toggleModule = (id) => {
    setRegistry(prev => ({ ...prev, [id]: { ...prev[id], active: !prev[id].active } }));
  };

  const triggerGlobalLockout = () => setIsLocked(true);
  const unlockSystem = () => setIsLocked(false);

  return { registry, jobs, isLocked, addJob, updateJob, toggleModule, triggerGlobalLockout, unlockSystem };
};