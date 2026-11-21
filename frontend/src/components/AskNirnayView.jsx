import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Quote,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import TranscriptDrawer from '../ui/TranscriptDrawer';

export default function AskNirnayView({ showToast }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Namaste! Main Nirnay hoon. Main aapke historical meetings, decisions, tasks aur transcripts se direct answers aur exact citations de sakta hoon. Aap mujhse Hindi, English ya Hinglish mein pooch sakte hain.',
      citations: [],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(null); // { meetingTitle, meetingDate, transcript, highlightQuote }
  const [meetingsCache, setMeetingsCache] = useState({});

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load meetings to cache transcripts for citation drawer
  useEffect(() => {
    fetch('/api/meetings')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const cache = {};
          data.forEach((m) => {
            cache[m.id] = m;
          });
          setMeetingsCache(cache);
        }
      })
      .catch(() => {});
  }, []);

  const suggestedQuestions = [
    'Pricing ka final decision kya hai aur pehle kya tha?',
    'Amit ke paas kya pending hai?',
    'Launch date kyun badli?',
    'Kaun overloaded hai?',
  ];

  const handleSendMessage = async (textToSend) => {
    const q = (textToSend || inputValue).trim();
    if (!q || loading) return;

    setErrorMsg(null);
    setInputValue('');

    const newHistory = [...messages, { role: 'user', content: q }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const historyPayload = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history: historyPayload }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.answer,
            citations: data.citations || [],
            answerable: data.answerable,
          },
        ]);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || 'Request failed. Rate limit or connection issue.');
        if (showToast) showToast('Failed to get answer. Please retry.', 'error');
      }
    } catch (e) {
      setErrorMsg('Network error communicating with Nirnay backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCitation = async (cit) => {
    const mId = cit.meeting_id;
    let m = meetingsCache[mId];

    if (!m) {
      try {
        const res = await fetch(`/api/meetings`);
        const list = await res.json();
        const found = list.find((item) => item.id === mId);
        if (found) m = found;
      } catch (e) {}
    }

    setActiveDrawer({
      meetingTitle: m ? m.title : `Meeting #${mId}`,
      meetingDate: m?.meeting_date,
      transcript: m ? m.transcript : cit.quote,
      highlightQuote: cit.quote,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-3xl mx-auto p-6 space-y-4 bg-white">
      {/* Header */}
      <div className="pb-4 border-b border-[#e7e9ee] shrink-0">
        <h1 className="text-[22px] font-semibold text-[#0f1222]">
          Ask Nirnay
        </h1>
        <p className="text-[13px] text-[#5e6477] mt-0.5">
          Ask questions about past decisions, deadlines, owners, or timeline conflicts with verified transcript citations.
        </p>
      </div>

      {/* Suggested Questions: Plain text links with underlines */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 shrink-0 text-[13px] text-[#5e6477]">
        <span className="shrink-0 flex items-center gap-1 font-medium text-[#8a90a2]">
          <HelpCircle className="w-3.5 h-3.5" /> Suggestions:
        </span>
        {suggestedQuestions.map((sq, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => handleSendMessage(sq)}
            className="text-[#1e35c7] hover:underline whitespace-nowrap transition-colors shrink-0 disabled:opacity-50 text-[13px]"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl p-4 rounded-[8px] text-[14px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#f7f8fa] border border-[#e7e9ee] text-[#0f1222] font-medium'
                  : 'bg-white border border-[#e7e9ee] text-[#0f1222]'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Citations list under assistant message */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#e7e9ee] space-y-2">
                  <div className="text-[11px] font-semibold text-[#5e6477] flex items-center gap-1">
                    <Quote className="w-3 h-3" />
                    <span>Verified citations</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {msg.citations.map((cit, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => handleOpenCitation(cit)}
                        className="p-2 rounded-[6px] bg-[#f7f8fa] hover:bg-[#eef1fd] border border-[#e7e9ee] text-[13px] flex flex-col items-start gap-0.5 transition-colors text-left group"
                        title="Click to view full transcript line"
                      >
                        <span className="font-semibold text-[#1e35c7] text-[11px] group-hover:underline">
                          Meeting {cit.meeting_id}
                        </span>
                        <span className="font-serif italic text-[#0f1222]">"{cit.quote}"</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start">
            <div className="p-3.5 rounded-[8px] bg-[#f7f8fa] border border-[#e7e9ee] text-[13px] text-[#5e6477] animate-pulse">
              Searching meeting memory and verifying citations...
            </div>
          </div>
        )}

        {/* Error Retry Banner */}
        {errorMsg && (
          <div className="p-3 rounded-[6px] bg-[#fdf1f1] border border-[#d0272d]/30 text-[13px] text-[#d0272d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => handleSendMessage()}
              className="px-2.5 py-1 rounded-[4px] bg-[#d0272d] hover:bg-[#b52026] text-white text-[12px] font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="pt-2 border-t border-[#e7e9ee] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            placeholder="Ask about decisions, deadlines, owners, or timeline conflicts..."
            className="flex-1 px-3.5 py-2.5 bg-white border border-[#cdd1da] rounded-[6px] text-[14px] text-[#0f1222] placeholder-[#8a90a2] focus:border-[#1e35c7] focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="px-4 py-2.5 rounded-[6px] bg-[#1e35c7] hover:bg-[#172aa3] disabled:opacity-40 text-white text-[13px] font-semibold transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* Slide-over Transcript Drawer */}
      {activeDrawer && (
        <TranscriptDrawer
          isOpen={true}
          onClose={() => setActiveDrawer(null)}
          meetingTitle={activeDrawer.meetingTitle}
          meetingDate={activeDrawer.meetingDate}
          transcript={activeDrawer.transcript}
          highlightQuote={activeDrawer.highlightQuote}
        />
      )}
    </div>
  );
}
