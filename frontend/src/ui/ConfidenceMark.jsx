import React from 'react';

export default function ConfidenceMark({ score }) {
  if (score === null || score === undefined) return null;
  const num = typeof score === 'number' ? (score <= 1 ? Math.round(score * 100) : Math.round(score)) : parseInt(score, 10);
  if (isNaN(num)) return null;

  const isFilled = num >= 85;
  const isHalf = num >= 65 && num < 85;

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft tabular-nums" title={`Confidence: ${num}%`}>
      <svg className="w-3 h-3 text-ink-soft shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6" />
        {isFilled && <circle cx="8" cy="8" r="4.5" fill="currentColor" stroke="none" />}
        {isHalf && (
          <path d="M 8 2 A 6 6 0 0 1 8 14 Z" fill="currentColor" stroke="none" />
        )}
      </svg>
      <span>{num}%</span>
    </span>
  );
}
