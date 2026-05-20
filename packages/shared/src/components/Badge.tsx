import React from 'react';

export type BadgeVariant =
  | 'green'
  | 'amber'
  | 'red'
  | 'gray'
  | 'blue';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  green: 'bg-[#EAF3DE] text-[#27500A]',
  amber: 'bg-amber-100 text-amber-800',
  red:   'bg-red-100 text-[#A32D2D]',
  gray:  'bg-gray-100 text-gray-700',
  blue:  'bg-blue-100 text-blue-800',
};

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
