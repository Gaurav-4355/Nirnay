import React from 'react';

export default function RedPenStrike({ children, className = '' }) {
  return (
    <span className={`animate-red-pen text-ink-faint decoration-red ${className}`}>
      {children}
    </span>
  );
}
