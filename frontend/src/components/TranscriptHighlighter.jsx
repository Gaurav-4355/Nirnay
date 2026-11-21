import React, { useEffect, useRef } from 'react';
import { Quote, Search } from 'lucide-react';

const SPEAKER_COLORS = {
  Rahul: 'text-blue-400 bg-blue-950/60 border-blue-800/80',
  Priya: 'text-purple-400 bg-purple-950/60 border-purple-800/80',
  Amit: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80',
  Sneha: 'text-amber-400 bg-amber-950/60 border-amber-800/80',
  Karan: 'text-rose-400 bg-rose-950/60 border-rose-800/80',
};

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
      <div className="h-full flex items-center justify-center text-slate-600 text-sm italic p-6">
        No transcript loaded. Enter or load a transcript on the left.
      </div>
    );
  }

  const lines = transcript.split('\n');

  // Helper to determine if a line matches the activeQuote
  const isLineActive = (line) => {
    if (!activeQuote || !activeQuote.evidence_quote) return false;
    const cleanQuote = activeQuote.evidence_quote.trim().toLowerCase();
    const cleanLine = line.trim().toLowerCase();
    if (!cleanQuote || !cleanLine) return false;
    return cleanLine.includes(cleanQuote) || cleanQuote.includes(cleanLine);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Quote className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Transcript Inspector
          </span>
        </div>
        {activeQuote ? (
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Highlighted Quote
          </span>
        ) : (
          <span className="text-xs text-slate-500">
            Click any evidence quote to highlight
          </span>
        )}
      </div>

      {/* Transcript Text Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs leading-relaxed"
      >
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-2"></div>;

          const match = line.match(/^([A-Za-z]+):\s*(.*)$/);
          const speaker = match ? match[1] : null;
          const speech = match ? match[2] : line;
          const active = isLineActive(line);
          const speakerBadgeClass = speaker && SPEAKER_COLORS[speaker]
            ? SPEAKER_COLORS[speaker]
            : 'text-slate-400 bg-slate-800/80 border-slate-700';

          return (
            <div
              key={idx}
              ref={active ? activeLineRef : null}
              className={`p-2.5 rounded-xl transition-all duration-300 border ${
                active
                  ? 'bg-amber-950/40 border-amber-400 shadow-lg shadow-amber-950/50 ring-2 ring-amber-500/30 translate-x-1'
                  : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-[10px] text-slate-600 select-none w-5 text-right shrink-0 pt-0.5">
                  {idx + 1}
                </span>

                <div className="flex-1">
                  {speaker && (
                    <span
                      className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md border mr-2 uppercase tracking-wide select-none ${speakerBadgeClass}`}
                    >
                      {speaker}
                    </span>
                  )}
                  <span
                    className={
                      active
                        ? 'text-amber-100 font-semibold bg-amber-500/20 px-1 py-0.5 rounded'
                        : 'text-slate-300'
                    }
                  >
                    {speech}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
