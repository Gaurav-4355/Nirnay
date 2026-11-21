import React, { useEffect, useRef } from 'react';
import { X, Quote, Calendar, FileText } from 'lucide-react';
import Avatar from './Avatar';

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/15 flex justify-end">
      <div
        className="w-full max-w-xl bg-white h-full shadow-elevated border-l border-[#e7e9ee] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#e7e9ee] flex items-center justify-between bg-white">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#5e6477]" />
              <h3 className="text-[15px] font-semibold text-[#0f1222]">
                {meetingTitle || 'Meeting transcript'}
              </h3>
            </div>
            {meetingDate && (
              <p className="text-[12px] text-[#5e6477] flex items-center gap-1 tabular-nums">
                <Calendar className="w-3 h-3 text-[#8a90a2]" />
                <span>{meetingDate}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[6px] text-[#8a90a2] hover:text-[#0f1222] hover:bg-[#f7f8fa] transition-colors"
            title="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Highlight Alert Banner if active quote */}
        {highlightQuote && (
          <div className="px-4 py-2.5 bg-[#ffe066]/20 border-b border-[#ffe066] text-[13px] text-[#0f1222] flex items-start gap-2">
            <Quote className="w-3.5 h-3.5 text-[#b26b00] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Target citation:</span>{' '}
              <span className="font-serif italic">"{highlightQuote}"</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-sans text-[13px] text-[#0f1222] leading-relaxed divide-y divide-[#e7e9ee]">
          {lines.length === 0 || !transcript ? (
            <p className="text-[#8a90a2] italic text-center py-12">No transcript content available.</p>
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
                  className={`pt-2.5 pb-1 transition-colors rounded-[4px] px-2 -mx-2 ${
                    isMatch
                      ? 'bg-[#ffe066]/30 border-l-2 border-[#1e35c7] font-medium'
                      : 'hover:bg-[#f7f8fa]'
                  }`}
                >
                  {speaker ? (
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Avatar name={speaker} size="xs" />
                        <span className="font-semibold text-[#0f1222] text-[12px]">{speaker}:</span>
                      </div>
                      <p className={`ml-4 ${isMatch ? 'font-serif italic text-[#0f1222]' : 'font-serif text-[#0f1222] text-[15px]'}`}>
                        {isMatch ? (
                          <mark className="bg-[#ffe066] text-[#0f1222] px-0.5 rounded-[2px]">
                            {text}
                          </mark>
                        ) : (
                          text
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className={`font-serif ${isMatch ? 'italic text-[#0f1222]' : 'text-[#5e6477]'}`}>
                      {line}
                    </p>
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
