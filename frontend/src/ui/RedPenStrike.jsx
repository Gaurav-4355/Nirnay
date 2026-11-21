import React from 'react';

/**
 * RedPenStrike - animated red-pen strike-through line
 * Used for superseded decisions, deadline changes, and overridden values.
 */
export default function RedPenStrike({ children, className = '' }) {
  return (
    <span className={`animate-red-pen text-[#8a90a2] decoration-[#d0272d] ${className}`}>
      {children}
    </span>
  );
}
