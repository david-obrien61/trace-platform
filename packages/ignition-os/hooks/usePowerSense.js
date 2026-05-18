import { useState, useEffect } from 'react';
import DataBridge from '../DataBridge';

export const usePowerSense = () => {
  const [isToolboxMode, setIsToolboxMode] = useState(true);
  const [voiceMode, setVoiceMode] = useState('PROXIMITY_WAKE');
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);

  useEffect(() => {
    // Use the standard Web Battery API to detect if the iPad is plugged into the bay charger
    let batteryRef;
    const updatePowerState = () => {
      if (batteryRef.charging) {
        // Plugged in: Neon borders, constant voice listening, no auto-lock
        setIsToolboxMode(true);
        setVoiceMode('PROXIMITY_WAKE');
        setAutoLockEnabled(false);
      } else {
        // Unplugged (Walking around): Dim screen borders, tap-to-talk, 5 min auto-lock
        setIsToolboxMode(false);
        setVoiceMode('MANUAL_WAKE');
        setAutoLockEnabled(DataBridge.load('shop_policy')?.autoLockEnabled ?? true);
      }
    };

    if ('getBattery' in navigator) {
      navigator.getBattery().then(b => {
        batteryRef = b;
        updatePowerState();
        batteryRef.addEventListener('chargingchange', updatePowerState);
      });
    }

    return () => {
      if (batteryRef) batteryRef.removeEventListener('chargingchange', updatePowerState);
    };
  }, []);

  return { isToolboxMode, voiceMode, autoLockEnabled };
};