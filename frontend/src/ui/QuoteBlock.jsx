import React from 'react';

export default function QuoteBlock({
  quote,
  speaker,
  meetingTitle,
  meetingDate,
  onClick,
  className = '',
}) {
  if (!quote) return null;

  return (
    <div
      onClick={onClick}
      className={`border-l-2 border-line-strong pl-3 py-1 my-1.5 transition-colors ${
        onClick ? 'cursor-pointer hover:border-accent hover:bg-fill rounded-r' : ''
      } ${className}`}
      title={onClick ? 'Click to inspect in transcript' : undefined}
    >
      <p className="font-serif italic text-ink text-[15px] leading-relaxed">
        "{quote}"
      </p>
      {(speaker || meetingTitle) && (
        <div className="flex items-center gap-2 mt-1 text-[13px] text-ink-soft font-sans">
          {speaker && <span className="font-medium text-ink">— {speaker}</span>}
          {meetingTitle && (
            <span>
              in {meetingTitle}
              {meetingDate && ` (${meetingDate})`}
            </span>
          )}
          {onClick && (
            <span className="text-accent-text text-[12px] hover:underline ml-1">
              View in transcript
            </span>
          )}
        </div>
      )}
    </div>
  );
}
