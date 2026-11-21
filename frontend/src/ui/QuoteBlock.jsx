import React from 'react';

/**
 * QuoteBlock - what PEOPLE said, rendered in Newsreader serif.
 * The yellow highlighter is used on evidence citation.
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
      className={`border-l-2 border-[#cdd1da] pl-3 py-1 my-1.5 transition-colors ${
        onClick ? 'cursor-pointer hover:border-[#1e35c7] hover:bg-[#f7f8fa] rounded-r' : ''
      } ${className}`}
      title={onClick ? 'Click to inspect in transcript' : undefined}
    >
      <p className="font-serif italic text-[#0f1222] text-[15px] leading-relaxed">
        "{quote}"
      </p>
      {(speaker || meetingTitle) && (
        <div className="flex items-center gap-2 mt-1 text-[13px] text-[#5e6477] font-sans">
          {speaker && <span className="font-medium text-[#0f1222]">— {speaker}</span>}
          {meetingTitle && (
            <span>
              in {meetingTitle}
              {meetingDate && ` (${meetingDate})`}
            </span>
          )}
          {onClick && (
            <span className="text-[#1e35c7] text-[12px] hover:underline ml-1">
              View in transcript
            </span>
          )}
        </div>
      )}
    </div>
  );
}
