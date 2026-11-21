import React from 'react';

/**
 * RedPenStrike - animated red ink strikethrough line
 * Used for superseded decisions, deadline slips, or overridden values.
 */
export default function RedPenStrike({ children, className = '' }) {
  return (
    <span className={`animate-red-pen text-stone-500 line-through decoration-red-600 decoration-2 ${className}`}>
      {children}
    </span>
  );
}
