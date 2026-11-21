import React from 'react';
import { STAMP_STYLES } from './tokens';

export default function StampBadge({ status, label, className = '' }) {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '_');
  const style = STAMP_STYLES[normalized] || 'bg-fill text-ink-soft border-line';
  
  let text = label || status?.replace(/_/g, ' ') || '';
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[12px] font-medium border leading-none tracking-normal select-none ${style} ${className}`}
    >
      {text}
    </span>
  );
}
