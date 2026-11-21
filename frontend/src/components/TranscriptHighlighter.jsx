import React, { useEffect, useRef } from 'react';
import { Quote } from 'lucide-react';
import Avatar from '../ui/Avatar';

export default function TranscriptHighlighter({ transcript, activeQuote }) {
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);

  // Auto-scroll when activeQuote changes
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeQuote]);

  if (!transcript) {
    return (
      <div className="h-full flex items-center justify-center text-ink-faint text-[13px] italic p-6">
        No transcript loaded. Enter or select a transcript on the left.
      </div>
    );
  }

  const lines = transcript.split('\n');

  // Helper to determine if a line matches the activeQuote
  const isLineActive = (line) => {
    if (!activeQuote) return false;
    const targetQuote = typeof activeQuote === 'string' ? activeQuote : activeQuote.evidence_quote;
    if (!targetQuote) return false;
    const cleanQuote = targetQuote.trim().toLowerCase();
    const cleanLine = line.trim().toLowerCase();
    if (!cleanQuote || !cleanLine) return false;
    return cleanLine.includes(cleanQuote) || cleanQuote.includes(cleanLine);
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-line rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-fill border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Quote className="w-3.5 h-3.5 text-ink-soft" />
          <span className="text-[12px] font-semibold text-ink">
            Transcript record
          </span>
        </div>
        {activeQuote ? (
          <span className="text-[11px] font-medium text-ink bg-highlight px-2 py-0.5 rounded-[3px]">
            Citing line
          </span>
        ) : (
          <span className="text-[11px] text-ink-faint">
            Click any quote to inspect
          </span>
        )}
      </div>

      {/* Transcript Text Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 leading-relaxed"
      >
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-2"></div>;

          const match = line.match(/^([A-Za-z]+):\s*(.*)$/);
          const speaker = match ? match[1] : null;
          const speech = match ? match[2] : line;
          const active = isLineActive(line);

          return (
            <div
              key={idx}
              ref={active ? activeLineRef : null}
              className={`p-2 rounded-[6px] transition-colors ${
                active
                  ? 'bg-highlight/30 border-l-2 border-accent'
                  : 'hover:bg-fill'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-[12px] text-ink-faint select-none w-6 text-right shrink-0 pt-0.5 tabular-nums">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  {speaker && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Avatar name={speaker} size="xs" />
                      <span className="font-sans text-[12px] font-semibold text-ink">
                        {speaker}
                      </span>
                    </div>
                  )}
                  <p
                    className={`font-serif text-[15.5px] leading-relaxed ${
                      active ? 'text-ink font-medium' : 'text-ink'
                    }`}
                  >
                    {active ? (
                      <mark className="bg-highlight text-ink px-0.5 rounded-[2px]">
                        {speech}
                      </mark>
                    ) : (
                      speech
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
