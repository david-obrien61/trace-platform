/**
 * FILE: SlideToComplete.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Custom slide-to-confirm physical interaction widget for completing critical tasks.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronsRight } from 'lucide-react';

const STYLE_DEBUG = false;

// Non-1:1 mappings flagged:
// - cursor-grab / active:cursor-grabbing → kept via className="ign-slide-thumb" (ignition-theme.css)
// - transition-opacity duration-300 → style={{ transition: 'opacity 0.3s' }}
// - shadow-inner → not preserved inline (no direct inline equivalent); flagged below
// [TRACE:STYLE] SlideToComplete converted, 8 classNames → inline, 3 non-1:1:
//   (1) cursor-grab/active:cursor-grabbing → ign-slide-thumb CSS class
//   (2) shadow-inner → dropped (inset shadow on track not preserved)
//   (3) conditional className pattern for isDragging opacity → converted to conditional style object

const SlideToComplete = ({ onComplete }) => {
  const [dragProgress, setDragProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const trackRef = useRef(null);
  const lastVibrateSnap = useRef(0);

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] SlideToComplete converted, 8 classNames → inline, 3 non-1:1');

  const startDrag = (e) => {
    if (isCompleted) return;
    setIsDragging(true);
  };

  const handleDrag = (clientX) => {
    if (!isDragging || isCompleted || !trackRef.current) return;

    const trackRect = trackRef.current.getBoundingClientRect();
    const handleWidth = 96; // w-24 = 96px
    const maxDragPos = trackRect.width - handleWidth - 8; // 8px for padding/borders

    let currentDragPos = clientX - trackRect.left - (handleWidth / 2);
    if (currentDragPos < 0) currentDragPos = 0;
    if (currentDragPos > maxDragPos) currentDragPos = maxDragPos;

    let progress = (currentDragPos / maxDragPos) * 100;
    progress = Math.min(Math.max(progress, 0), 100);
    setDragProgress(progress);

    const currentSnap = Math.floor(progress / 10);
    if (currentSnap > lastVibrateSnap.current) {
        if (navigator.vibrate) navigator.vibrate(15);
        lastVibrateSnap.current = currentSnap;
    } else if (currentSnap < lastVibrateSnap.current) {
        lastVibrateSnap.current = currentSnap;
    }

    if (progress >= 100) {
      if (navigator.vibrate) navigator.vibrate([200]);
      setIsCompleted(true);
      setIsDragging(false);
      if (onComplete) {
         setTimeout(() => {
             onComplete();
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
    if (dragProgress < 100) {
      setDragProgress(0);
      lastVibrateSnap.current = 0;
    }
  };

  useEffect(() => {
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
      style={{
        position: 'relative',
        width: '100%',
        height: 96,
        backgroundColor: '#020617',   // slate-950
        border: '6px solid rgba(30,41,59,0.8)',  // slate-800/80
        borderRadius: 40,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        // shadow-inner: not preserved — flagged non-1:1
        maxWidth: 512,
        margin: '0 auto',
      }}
    >
      {/* CENTRAL TYPOGRAPHY */}
      <span style={{
        position: 'absolute',
        zIndex: 0,
        fontSize: 20,
        fontWeight: 900,
        fontStyle: 'italic',
        letterSpacing: '0.1em',
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
        opacity: isDragging ? 0.2 : 1,
        color: dragProgress > 50 ? '#1e293b' : '#64748b', // slate-800 : slate-500
      }}>
        SLIDE TO FINISH JOB
      </span>

      {/* EMERALD WAKE TRAIL */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          backgroundColor: 'rgba(16,185,129,0.2)',  // emerald-500/20
          borderRight: '1px solid rgba(16,185,129,0.5)',
          boxShadow: '0 0 30px rgba(16,185,129,0.3) inset',
          pointerEvents: 'none',
          width: `calc(${dragProgress}% + 3rem)`,
          transition: isDragging ? 'none' : 'width 0.4s ease-out',
        }}
      />

      {/* GRIP HANDLE — cursor-grab/active:cursor-grabbing via ign-slide-thumb CSS class */}
      <div
        className="ign-slide-thumb"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{
          position: 'absolute',
          top: 6,
          bottom: 6,
          width: 96,
          backgroundColor: '#10b981',   // emerald-500
          borderRadius: 29,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(16,185,129,0.5)',
          zIndex: 10,
          border: '2px solid #34d399',  // emerald-400
          left: `calc(6px + ${dragProgress}% - ${dragProgress / 100 * 104}px)`,
          transition: isDragging ? 'none' : 'all 0.4s ease-out',
        }}
      >
        {/* GRIP RIDGES */}
        <div style={{ display: 'flex', gap: 6, marginRight: 8, opacity: 0.6 }}>
          <div style={{ width: 6, height: 32, backgroundColor: '#022c22', borderRadius: 9999, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} />
          <div style={{ width: 6, height: 32, backgroundColor: '#022c22', borderRadius: 9999, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} />
        </div>
        <ChevronsRight size={32} style={{ color: '#022c22', marginLeft: 4 }} />
      </div>
    </div>
  );
};

export default SlideToComplete;
