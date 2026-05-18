/**
 * FILE: useIgnitionCipher.js
 * PLATFORM: Universal (React Hooks)
 * PURPOSE: State engine for managing secure user authentication (PINs), role-based permissions, and liability waivers.
 * DEPENDENCIES: react
 */

import { useState } from 'react';

export const useIgnitionCipher = () => {
  const [activeProfile, setActiveProfile] = useState(null);

  const [profiles, setProfiles] = useState({
    '1111': { 
      name: 'A. MANAGER', role: 'ADMIN', 
      allowed: ['intake', 'queue', 'vin', 'voice', 'estimates', 'parts', 'procure', 'tools', 'inv', 'admin', 'fleet'],
      preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] },
      hasSignedWaiver: true
    },
    '1234': { 
      name: 'T. OBRIEN', role: 'TECHNICIAN', 
      allowed: ['queue', 'vin', 'voice', 'parts', 'tools'],
      preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model', 'Displacement (L)'] },
      hasSignedWaiver: false // Needs to sign waiver on next login!
    },
    '2222': { 
      name: 'S. WRITER', role: 'SERVICE', 
      allowed: ['intake', 'queue', 'vin', 'estimates', 'parts', 'procure'],
      preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] },
      hasSignedWaiver: true
    },
    '3333': { 
      name: 'L. PILOT', role: 'DEVELOPER', 
      allowed: ['intake', 'queue', 'vin', 'voice', 'estimates', 'parts', 'procure', 'tools', 'inv', 'admin', 'fleet'],
      preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model', 'VIN'] },
      hasSignedWaiver: true
    }
  });

  const authenticate = (pin) => {
    if (profiles[pin]) {
      // Inject the PIN as a unique ID to make updates safe and O(1)
      setActiveProfile({ ...profiles[pin], id: pin });
      return true;
    }
    return false;
  };

  const updatePrefs = (newPins) => {
    if (!activeProfile) return;
    const pin = activeProfile.id;
    setProfiles(prev => ({ ...prev, [pin]: { ...prev[pin], preferences: { pinnedSpecs: newPins } } }));
    setActiveProfile(prev => ({ ...prev, preferences: { pinnedSpecs: newPins } }));
  };

  const signWaiver = () => {
    if (!activeProfile) return;
    const pin = activeProfile.id;
    setProfiles(prev => ({ ...prev, [pin]: { ...prev[pin], hasSignedWaiver: true } }));
    setActiveProfile(prev => ({ ...prev, hasSignedWaiver: true }));
  };

  const logout = () => setActiveProfile(null);

  return { activeProfile, authenticate, logout, updatePrefs, signWaiver };
};