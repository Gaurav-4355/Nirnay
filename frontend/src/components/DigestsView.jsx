import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Calendar,
  Layers,
  CheckSquare,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export default function DigestsView({ onNavigateToOutbox }) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [digestsData, setDigestsData] = useState(null);
  const [existingOutboxDigests, setExistingOutboxDigests] = useState([]);
  const [notification, setNotification] = useState(null);

  const fetchExistingDigests = () => {
    setLoading(true);
    fetch('/api/outbox')
      .then((res) => res.json())
      .then((items) => {
        if (Array.isArray(items)) {
          const digests = items.filter((i) => i.kind === 'digest');
          setExistingOutboxDigests(digests);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching outbox digests:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchExistingDigests();
  }, []);

  const handleGenerateDigests = async () => {
    setGenerating(true);
    setNotification(null);
    try {
      const res = await fetch('/api/digests/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDigestsData(data);
        setNotification(
          `Generated weekly digests for ${data.team_size || data.digests?.length || 0} team member(s) (week of ${data.week_start}). Queued in Outbox for approval.`
        );
        fetchExistingDigests();
      } else {
        const errData = await res.json().catch(() => ({}));
        setNotification(`Error generating digests: ${errData.detail || 'Request failed'}`);
      }
    } catch (err) {
      console.error('Error generating weekly digests:', err);
      setNotification('Failed to generate weekly digests.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-400" />
            Weekly Team Digests
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Generate and review cross-meeting commitment summaries per owner with AI executive briefs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToOutbox && (
            <button
              onClick={onNavigateToOutbox}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all"
            >
              <Send className="w-3.5 h-3.5 text-indigo-400" />
              <span>Go to Outbox</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={handleGenerateDigests}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Compiling Digests...' : 'Generate Weekly Digests'}</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{notification}</span>
          </div>
          {onNavigateToOutbox && (
            <button
              onClick={onNavigateToOutbox}
              className="px-3 py-1 rounded-lg bg-purple-800/80 hover:bg-purple-700 text-white font-semibold text-xs transition-colors shrink-0"
            >
              Review Outbox
            </button>
          )}
        </div>
      )}

      {/* Newly Generated Digest Cards */}
      {digestsData && digestsData.digests && digestsData.digests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Generated Digest Run (Week of {digestsData.week_start})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {digestsData.digests.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-900/70 border border-purple-900/40 hover:border-purple-800/60 transition-all space-y-4 shadow-sm"
              >
                {/* Person Header & Stats */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-950 text-purple-300 border border-purple-800 flex items-center justify-center font-bold text-xs">
                      {item.owner.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {item.owner}
                      </h3>
                      <span className="text-[11px] text-slate-400">Team Member</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {item.stats?.done || 0} done
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      {item.stats?.pending || 0} pending
                    </span>
                    {(item.stats?.overdue || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        {item.stats.overdue} overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Executive Summary */}
                {item.summary && (
                  <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <strong className="text-purple-300 block mb-1">Executive Summary:</strong>
                    {item.summary}
                  </div>
                )}

                {/* Highlights */}
                {item.highlights && item.highlights.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Key Highlights:
                    </span>
                    <ul className="space-y-1 text-slate-300">
                      {item.highlights.map((h, hIdx) => (
                        <li key={hIdx} className="flex items-start gap-1.5">
                          <span className="text-purple-400 mt-0.5">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Full Body / Code-rendered Task Bullets */}
                <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-950/40 p-2.5 rounded-xl">
                  {item.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Outbox Digest Items */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Saved Outbox Digests ({existingOutboxDigests.length})
          </span>
          {onNavigateToOutbox && existingOutboxDigests.length > 0 && (
            <button
              onClick={onNavigateToOutbox}
              className="text-indigo-400 hover:text-indigo-300 normal-case font-semibold text-xs flex items-center gap-1"
            >
              <span>Manage in Outbox</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {existingOutboxDigests.length === 0 && !digestsData ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80">
            <FileText className="w-10 h-10 text-purple-400/60 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-white">No weekly digests generated yet</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Click "Generate Weekly Digests" above to synthesize commitment reports for all active team members across recent meetings.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {existingOutboxDigests.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-sm font-bold text-white">@{item.recipient}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.status === 'sent'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : item.status === 'pending'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200">{item.title}</div>

                <div className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap bg-slate-950/70 p-3 rounded-xl border border-slate-800 max-h-40 overflow-y-auto leading-relaxed">
                  {item.body}
                </div>

                <div className="text-[10px] text-slate-500 font-mono">
                  Dedupe: {item.dedupe_key}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
