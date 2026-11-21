import React from 'react';
import { Quote } from 'lucide-react';

/**
 * QuoteBlock - editorial quote block rendered in serif italic style
 * Clicking activates the quote span in the transcript drawer.
 */
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
      className={`group border-l-2 border-stone-300 pl-3 py-1 my-1.5 transition-colors ${
        onClick ? 'cursor-pointer hover:border-indigo-600 hover:bg-stone-50/60 rounded-r' : ''
      } ${className}`}
      title={onClick ? 'Click to inspect in transcript' : undefined}
    >
      <p className="font-serif italic text-stone-800 text-sm leading-relaxed">
        "{quote}"
      </p>
      {(speaker || meetingTitle) && (
        <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 font-sans">
          {speaker && <span className="font-medium text-stone-700">— {speaker}</span>}
          {meetingTitle && (
            <span>
              in {meetingTitle}
              {meetingDate && ` (${meetingDate})`}
            </span>
          )}
          {onClick && (
            <span className="text-indigo-600 underline text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
              View transcript
            </span>
          )}
        </div>
      )}
    </div>
  );
}
