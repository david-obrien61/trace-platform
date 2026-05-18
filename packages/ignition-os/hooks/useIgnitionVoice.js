import { useState, useEffect, useRef } from 'react';

const WAKE_WORD = 'ignition';

export const useIgnitionVoice = (onCommand, voiceMode) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      if (transcript.startsWith(WAKE_WORD)) {
        const command = transcript.replace(WAKE_WORD, '').trim();
        if (command && onCommand) onCommand(command);
      }
    };

    recognition.onend = () => {
      // Restart automatically in proximity mode so it keeps listening
      if (voiceMode === 'PROXIMITY_WAKE') {
        try { recognition.start(); } catch (_) {}
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') setIsListening(false);
    };

    if (voiceMode === 'PROXIMITY_WAKE') {
      try { recognition.start(); setIsListening(true); } catch (_) {}
    }

    return () => {
      try { recognition.stop(); } catch (_) {}
    };
  }, [voiceMode, onCommand]);

  const startListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); setIsListening(true); } catch (_) {}
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); setIsListening(false); } catch (_) {}
    }
  };

  return { isListening, startListening, stopListening };
};
