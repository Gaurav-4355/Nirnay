import React, { useEffect, useRef } from 'react';
import { X, Quote, Calendar, FileText } from 'lucide-react';

export default function TranscriptDrawer({
  isOpen,
  onClose,
  meetingTitle,
  meetingDate,
  transcript,
  highlightQuote,
}) {
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (isOpen && activeLineRef.current) {
      setTimeout(() => {
        activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isOpen, highlightQuote]);

  if (!isOpen) return null;

  const lines = (transcript || '').split('\n');
  const cleanHighlight = (highlightQuote || '').trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-900/20 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-stone-200 flex flex-col slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-stone-600" />
              <h3 className="text-sm font-semibold text-stone-900">
                {meetingTitle || 'Meeting Transcript'}
              </h3>
            </div>
            {meetingDate && (
              <p className="text-xs text-stone-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-stone-400" />
                <span>{meetingDate}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
            title="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Highlight Alert Banner if active quote */}
        {highlightQuote && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
            <Quote className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Target citation:</span>{' '}
              <span className="font-serif italic text-amber-950">"{highlightQuote}"</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-sans text-xs text-stone-700 leading-relaxed divide-y divide-stone-100">
          {lines.length === 0 || !transcript ? (
            <p className="text-stone-400 italic text-center py-12">No transcript content available.</p>
          ) : (
            lines.map((line, idx) => {
              if (!line.trim()) return null;
              const isMatch =
                cleanHighlight &&
                (line.toLowerCase().includes(cleanHighlight) || cleanHighlight.includes(line.trim().toLowerCase()));

              const colonIdx = line.indexOf(':');
              const speaker = colonIdx > -1 ? line.substring(0, colonIdx) : null;
              const text = colonIdx > -1 ? line.substring(colonIdx + 1) : line;

              return (
                <div
                  key={idx}
                  ref={isMatch ? activeLineRef : null}
                  className={`pt-2.5 pb-1 transition-all rounded px-2 -mx-2 ${
                    isMatch
                      ? 'bg-amber-100/80 border-l-3 border-amber-600 text-stone-900 font-medium'
                      : 'hover:bg-stone-50'
                  }`}
                >
                  {speaker ? (
                    <div>
                      <span className="font-semibold text-stone-900">{speaker}:</span>
                      <span className={`ml-1.5 ${isMatch ? 'font-serif italic text-amber-950' : 'text-stone-700'}`}>
                        {text}
                      </span>
                    </div>
                  ) : (
                    <span className={isMatch ? 'font-serif italic text-amber-950' : 'text-stone-600'}>
                      {line}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
