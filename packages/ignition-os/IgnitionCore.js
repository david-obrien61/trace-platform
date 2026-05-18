/**
 * FILE: IgnitionCore.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Web core router and session guard enforcing idle lockouts and rendering the assigned application module.
 * DEPENDENCIES: react
 */

import React, { useState, useEffect } from 'react';
import DataBridge from './DataBridge';
import IgnitionOmni from './modules/IgnitionOmniDashboard';
import IgnitionKosk from './modules/IgnitionKosk';
import IgnitionPort from './modules/IgnitionPort';
import EnrollmentCatch from './EnrollmentCatch';
import OnboardingWizard from './OnboardingWizard';

/**
 * HOOK: useSessionGuard
 * DESC: Monitors activity and forces a lockout based on Shop Policy.
 */
const useSessionGuard = () => {
  useEffect(() => {
    const policy = DataBridge.load('shop_policy') || { autoLockEnabled: true };
    if (!policy.autoLockEnabled) return; // Flexibility Mode: Do nothing.

    let timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.warn("SESSION EXPIRED: Auto-locking for security.");
        DataBridge.save('current_user', null);
        window.location.reload(); // Force a clean slate
      }, 300000); // 5 Minutes
    };

    // Watch for greasy fingers on the screen
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('click', resetTimer);

    resetTimer(); // Start the clock

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('click', resetTimer);
      clearTimeout(timeout);
    };
  }, []);
};


/**
 * COMPONENT: Splash Screen
 * DESC: Secure Identity Required
 */
const IdentityRequiredSplash = () => {
  const [pin, setPin] = useState('');

  const handleAuth = () => {
    const user = DataBridge.authenticate(pin);
    if (user) {
      window.location.reload(); // Refresh to let the Core router mount the correct dashboard
    } else {
      alert("Invalid Access Code");
      setPin('');
    }
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(30,41,59,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="z-10 bg-slate-900/90 backdrop-blur-md p-10 rounded-[3rem] border border-slate-800 shadow-2xl w-full max-w-sm text-center">
        <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">System Locked</h1>
        <p className="text-[10px] font-mono text-slate-500 mb-8 uppercase tracking-[0.2em]">Secure Identity Required</p>
        
        <input 
          type="password" 
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="----"
          className="w-full bg-black border-2 border-slate-800 rounded-2xl p-4 text-center text-white font-black text-3xl tracking-[1em] mb-6 outline-none focus:border-blue-500 transition-colors"
        />

        <button onClick={handleAuth} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-blue-500 transition shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-95">
          Authenticate
        </button>
      </div>
    </div>
  );
};

const IgnitionCore = () => {
  useSessionGuard();

  // First-run gate: show onboarding wizard until shop is set up
  const shopPolicy = DataBridge.load('shop_policy');
  if (!shopPolicy?.onboarding_complete) {
    return <OnboardingWizard />;
  }

  const currentUser = DataBridge.load('current_user');

  const VersionBadge = () => (
    <div className="fixed top-4 right-4 bg-slate-950/80 backdrop-blur-sm border border-slate-700 px-4 py-2 rounded-full z-[100] pointer-events-none shadow-lg">
      <span className="text-[10px] font-mono text-blue-500 font-black uppercase tracking-widest">CoreApp.001</span>
    </div>
  );

  const urlParams = new URLSearchParams(window.location.search);
  const isEnrollUrl = urlParams.get('enroll') !== null;

  if (isEnrollUrl) {
    return (
      <>
        <VersionBadge />
        <EnrollmentCatch />
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <VersionBadge />
        <IdentityRequiredSplash />
      </>
    );
  }

  // Pending Enrollment Guard
  if (currentUser.status === 'PENDING_ENROLLMENT') {
    return (
      <>
        <VersionBadge />
        <EnrollmentCatch />
      </>
    );
  }

  // Router Execution
  let RouteView = null;
  const permissions = currentUser.permissions || [];

  if (permissions.includes('ADMIN')) {
    RouteView = <IgnitionOmni />;
  } else if (permissions.includes('TECH')) {
    RouteView = <IgnitionKosk />;
  } else if (permissions.includes('CUSTOMER')) {
    RouteView = <IgnitionPort />;
  } else {
    RouteView = (
      <div className="h-screen w-screen bg-black flex items-center justify-center p-10">
        <h1 className="text-2xl font-black text-slate-500 uppercase tracking-tighter">No Valid Layout Assigned</h1>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-black text-slate-200 overflow-hidden">
      <VersionBadge />
      {RouteView}
    </div>
  );
};

export default IgnitionCore;
