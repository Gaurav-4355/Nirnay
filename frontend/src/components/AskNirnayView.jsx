import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Quote,
  X,
  FileText,
  Clock,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import TranscriptHighlighter from './TranscriptHighlighter';

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
  const [citationModal, setCitationModal] = useState(null); // { meetingId, quote, meetingTitle, transcript }
  const [meetingsCache, setMeetingsCache] = useState({});

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load meetings to cache transcripts for citation modal
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

    setCitationModal({
      meetingId: mId,
      quote: cit.quote,
      meetingTitle: m ? m.title : `Meeting #${mId}`,
      transcript: m ? m.transcript : cit.quote,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-lg shadow-indigo-900/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Ask Nirnay
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                Grounded Memory
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Query cross-meeting commitments, superseded decisions, and timelines with verified transcript citations.
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Questions Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none text-xs">
        <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5" />
          Suggestions:
        </span>
        {suggestedQuestions.map((sq, idx) => (
          <button
            key={idx}
            disabled={loading}
            onClick={() => handleSendMessage(sq)}
            className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50 text-[11px]"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl p-4 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950 font-medium'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Citations list under assistant message */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                    <Quote className="w-3 h-3" />
                    <span>Verified Citations:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {msg.citations.map((cit, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => handleOpenCitation(cit)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/60 text-[11px] font-mono flex items-center gap-1.5 transition-colors text-left"
                        title="Click to view full transcript line"
                      >
                        <span className="font-bold">Meeting {cit.meeting_id}</span>
                        <span className="text-slate-500">•</span>
                        <span className="truncate max-w-[240px]">"{cit.quote}"</span>
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
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Nirnay is searching meeting memory & verifying quotes...</span>
            </div>
          </div>
        )}

        {/* Error Retry Banner */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => handleSendMessage()}
              className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-white font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="pt-2 border-t border-slate-800 shrink-0">
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
            className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* Citation Modal with TranscriptHighlighter */}
      {citationModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  SOURCE TRANSCRIPT VERIFICATION
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">
                  {citationModal.meetingTitle}
                </h3>
              </div>
              <button
                onClick={() => setCitationModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-indigo-950/20 border-b border-slate-800 text-xs text-indigo-200 flex items-center gap-2">
              <Quote className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-serif italic">Highlighted quote: "{citationModal.quote}"</span>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              <TranscriptHighlighter
                transcript={citationModal.transcript}
                highlightQuote={citationModal.quote}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
