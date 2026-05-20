import React from 'react';

export interface LockedOverlayProps {
  isLocked: boolean;
  message?: string;
  children: React.ReactNode;
}

export function LockedOverlay({
  isLocked,
  message = 'Upgrade to unlock this feature.',
  children,
}: LockedOverlayProps) {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none" style={{ filter: 'blur(4px)' }} aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 rounded-xl z-10">
        <svg
          className="w-8 h-8 text-[#27500A] mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <p className="text-sm font-semibold text-[#27500A] text-center px-4">{message}</p>
      </div>
    </div>
  );
}
