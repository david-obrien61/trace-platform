/**
 * FILE: SlideToComplete.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Custom slide-to-confirm physical interaction widget for completing critical tasks.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronsRight } from 'lucide-react';

const SlideToComplete = ({ onComplete }) => {
  const [dragProgress, setDragProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const trackRef = useRef(null);
  const lastVibrateSnap = useRef(0);

  const startDrag = (e) => {
    if (isCompleted) return;
    setIsDragging(true);
  };

  const handleDrag = (clientX) => {
    if (!isDragging || isCompleted || !trackRef.current) return;
    
    const trackRect = trackRef.current.getBoundingClientRect();
    const handleWidth = 96; // w-24 = 96px
    const maxDragPos = trackRect.width - handleWidth - 8; // 8px for padding/borders
    
    // Calculate raw X position relative to track
    let currentDragPos = clientX - trackRect.left - (handleWidth / 2);
    
    // Hard physical clamp so it doesn't leave the track
    if (currentDragPos < 0) currentDragPos = 0;
    if (currentDragPos > maxDragPos) currentDragPos = maxDragPos;

    let progress = (currentDragPos / maxDragPos) * 100;
    progress = Math.min(Math.max(progress, 0), 100);
    
    setDragProgress(progress);

    // Haptic Resistance: 10ms pulse every 10% movement increments
    const currentSnap = Math.floor(progress / 10);
    if (currentSnap > lastVibrateSnap.current) {
        if (navigator.vibrate) navigator.vibrate(15);
        lastVibrateSnap.current = currentSnap;
    } else if (currentSnap < lastVibrateSnap.current) {
        lastVibrateSnap.current = currentSnap; // Update fallback without pulse 
    }

    // Completion Trigger
    if (progress >= 100) {
      if (navigator.vibrate) navigator.vibrate([200]); // Huge "Thud" confirmation
      setIsCompleted(true);
      setIsDragging(false);
      
      if (onComplete) {
         // Tiny delay allows the user to see the success state lock-in before the UI shifts
         setTimeout(() => {
             onComplete();
             // Reset state for future reuse
             setIsCompleted(false);
             setDragProgress(0);
             lastVibrateSnap.current = 0;
         }, 500); 
      }
    }
  };

  const onMouseMove = (e) => handleDrag(e.clientX);
  const onTouchMove = (e) => handleDrag(e.touches[0].clientX);

  const endDrag = () => {
    if (isCompleted) return;
    setIsDragging(false);
    
    // Safety Net: Spring back to 0% if let go early
    if (dragProgress < 100) {
      setDragProgress(0);
      lastVibrateSnap.current = 0;
    }
  };

  useEffect(() => {
    // Only bind global window events when dragging begins to save memory
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', endDrag);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', endDrag);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', endDrag);
    };
  }, [isDragging, dragProgress, isCompleted]);

  return (
    <div 
       ref={trackRef}
       className="relative w-full h-24 bg-slate-950 border-[6px] border-slate-800/80 rounded-[2.5rem] overflow-hidden flex items-center justify-center select-none shadow-inner mx-auto max-w-lg"
    >
      {/* CENTRAL TYPOGRAPHY THEME */}
      <span className={`absolute z-0 text-xl font-black italic tracking-widest transition-opacity duration-300 pointer-events-none 
         ${isDragging ? 'opacity-20' : 'opacity-100'} 
         ${dragProgress > 50 ? 'text-slate-800' : 'text-slate-500'}
      `}>
        SLIDE TO FINISH JOB
      </span>
      
      {/* EMERALD WAKE TRAIL */}
      <div 
        className="absolute top-0 left-0 bottom-0 bg-emerald-500/20 border-r border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)_inset] pointer-events-none"
        style={{ width: `calc(${dragProgress}% + 3rem)`, transition: isDragging ? 'none' : 'width 0.4s ease-out' }}
      />
      
      {/* THE GRIP HANDLE */}
      <div 
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        className={`absolute top-1.5 bottom-1.5 w-24 bg-emerald-500 rounded-[1.8rem] flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10 border-2 border-emerald-400
          ${isDragging ? '' : 'transition-all duration-400 ease-out'} 
        `}
        style={{ 
           left: `calc(6px + ${dragProgress}% - ${dragProgress / 100 * 104}px)` 
        }} 
      >
        {/* TEXTURED GRIP RIDGES */}
        <div className="flex gap-1.5 mr-2 opacity-60">
           <div className="w-1.5 h-8 bg-emerald-950 rounded-full shadow-sm"></div>
           <div className="w-1.5 h-8 bg-emerald-950 rounded-full shadow-sm"></div>
        </div>
        <ChevronsRight size={32} className="text-emerald-950 ml-1" />
      </div>
    </div>
  );
};

export default SlideToComplete;
