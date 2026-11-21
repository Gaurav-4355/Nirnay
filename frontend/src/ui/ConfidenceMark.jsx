import React from 'react';

/**
 * ConfidenceMark: a small circle mark (filled / half / outlined) plus percentage text
 */
export default function ConfidenceMark({ score }) {
  if (score === null || score === undefined) return null;
  const num = typeof score === 'number' ? (score <= 1 ? Math.round(score * 100) : Math.round(score)) : parseInt(score, 10);
  if (isNaN(num)) return null;

  // Circle mark: filled if >= 85, half if >= 65, outlined otherwise
  const isFilled = num >= 85;
  const isHalf = num >= 65 && num < 85;

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#5e6477] tabular-nums" title={`Confidence: ${num}%`}>
      <svg className="w-3 h-3 text-[#5e6477] shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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
