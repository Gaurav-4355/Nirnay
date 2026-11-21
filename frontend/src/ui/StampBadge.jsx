import React from 'react';
import { STAMP_STYLES } from './tokens';

/**
 * StampBadge - small stamp-style status badge (e.g. Kept new, Kept old, Acknowledged, Done, Blocked)
 * Rendered like a physical ink stamp on paper: subtle border, muted paper fill, crisp text.
 */
export default function StampBadge({ status, label, className = '' }) {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '_');
  const style = STAMP_STYLES[normalized] || 'border-stone-400 text-stone-700 bg-stone-50';
  const displayLabel = label || status?.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border tracking-normal select-none ${style} ${className}`}
    >
      {displayLabel}
    </span>
  );
}
