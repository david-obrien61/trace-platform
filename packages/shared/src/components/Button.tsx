import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const BASE =
  'inline-flex items-center justify-center font-semibold rounded-lg cursor-pointer select-none ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[#27500A] text-white hover:bg-[#1e3d07] active:bg-[#162e05] focus:ring-[#27500A]',
  secondary:
    'bg-white text-[#27500A] border border-[#27500A] hover:bg-[#EAF3DE] active:bg-[#d5e8c0] focus:ring-[#27500A]',
  danger:
    'bg-[#A32D2D] text-white hover:bg-[#8a2626] active:bg-[#721f1f] focus:ring-[#A32D2D]',
  ghost:
    'bg-transparent text-[#27500A] hover:bg-[#EAF3DE] active:bg-[#d5e8c0] focus:ring-[#27500A]',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-2 text-sm min-h-[36px]',
  md: 'px-4 py-3 text-base min-h-[48px]',
  lg: 'px-6 py-4 text-lg min-h-[56px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
