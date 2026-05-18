/**
 * FILE: useIgnitionVoice.js
 * PLATFORM: Web (React DOM)
 * PURPOSE: Hook managing Web Speech API for tap-to-talk or continuous voice recognition.
 * DEPENDENCIES: react
 */

import { useEffect, useState } from 'react';

export const useIgnitionVoice = (onCommand, voiceMode = 'TAP_TO_TALK') => {
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    // Only run continuous voice listener if voiceMode is CONTINUOUS to save battery
    if (voiceMode !== 'CONTINUOUS') {
       console.log("Voice mode is TAP_TO_TALK. Continuous voice listener asleep.");
       setIsListening(false);
       return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
       console.warn("Speech Recognition API not supported in this browser.");
       return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
      
      if (command.includes('ignition')) {
        // Haptic Feedback
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        
        console.log("Ignition Command Detected:", command);
        onCommand(command.replace('ignition', '').trim());
      }
    };

    // Restart logic to keep it "Always-On" when it auto-stops in CONTINUOUS mode
    recognition.onend = () => {
       if (voiceMode === 'CONTINUOUS') {
           try { recognition.start(); } catch(e) {}
       } else {
           setIsListening(false);
       }
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.warn("Speech recognition error:", e);
    }

    return () => {
      recognition.onend = null; // Prevent restart loop
      recognition.stop();
      setIsListening(false);
    };
  }, [onCommand, voiceMode]);
  
  return { isListening: voiceMode === 'CONTINUOUS' };
};
