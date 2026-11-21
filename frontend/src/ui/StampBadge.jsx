import React from 'react';
import { STAMP_STYLES } from './tokens';

/**
 * StampBadge - sentence case, 12px, tinted background with meaning color text, 4px radius.
 * Never uppercase, never a colored pill shouting.
 */
export default function StampBadge({ status, label, className = '' }) {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '_');
  const style = STAMP_STYLES[normalized] || 'bg-[#f7f8fa] text-[#5e6477] border-[#e7e9ee]';
  
  // Convert label or status to clean sentence case
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
