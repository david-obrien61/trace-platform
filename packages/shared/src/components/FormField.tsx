import React from 'react';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ label, htmlFor, error, hint, required, children }: FormFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <label
        htmlFor={htmlFor}
        style={{ fontSize: 14, fontWeight: 600, color: '#333', userSelect: 'none' }}
      >
        {label}
        {required && <span style={{ color: '#A32D2D', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <span style={{ fontSize: 12, color: '#757575' }}>{hint}</span>
      )}
      {error && (
        <span style={{ fontSize: 12, color: '#A32D2D' }}>{error}</span>
      )}
    </div>
  );
}

// Shared input style — use on <input> / <select> / <textarea> elements
export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 15,
  border: '1.5px solid #BDBDBD',
  borderRadius: 8,
  outline: 'none',
  background: '#fff',
  color: '#1a1a1a',
  boxSizing: 'border-box',
  minHeight: 44,
};

export const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: '#A32D2D',
};
