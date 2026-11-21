import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Send,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import Avatar from '../ui/Avatar';
import StampBadge from '../ui/StampBadge';

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
          `Generated weekly summaries for ${data.team_size || data.digests?.length || 0} team member(s) (week of ${data.week_start}). Queued in Waiting for approval.`
        );
        fetchExistingDigests();
      } else {
        const errData = await res.json().catch(() => ({}));
        setNotification(`Error generating summaries: ${errData.detail || 'Request failed'}`);
      }
    } catch (err) {
      console.error('Error generating weekly summaries:', err);
      setNotification('Failed to generate weekly summaries.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-[760px] mx-auto space-y-8 bg-surface">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-[30px] font-bold text-ink tracking-[-0.02em] leading-tight">
            Weekly summaries
          </h1>
          <p className="text-[13px] text-ink-soft mt-0.5">
            Cross-meeting commitment summaries per owner with executive briefs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToOutbox && (
            <button
              onClick={onNavigateToOutbox}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium bg-surface hover:bg-fill text-ink border border-line transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-ink-soft" />
              <span>Waiting for approval</span>
            </button>
          )}

          <button
            onClick={handleGenerateDigests}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-1.5 rounded-[6px] text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors"
          >
            <Sparkles className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Compiling summaries...' : 'Generate weekly summaries'}</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className="p-3.5 rounded-[6px] bg-fill border border-line text-[13px] text-ink flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
            <span>{notification}</span>
          </div>
          {onNavigateToOutbox && (
            <button
              onClick={onNavigateToOutbox}
              className="text-accent-text hover:underline font-medium text-[12px] shrink-0"
            >
              Review in outbox
            </button>
          )}
        </div>
      )}

      {/* Newly Generated Digest Run */}
      {digestsData && digestsData.digests && digestsData.digests.length > 0 && (
        <section className="space-y-4">
          <div className="text-[14px] font-semibold text-ink">
            Generated run (Week of {digestsData.week_start})
          </div>

          <div className="space-y-4">
            {digestsData.digests.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-[10px] bg-surface border border-line space-y-3"
              >
                {/* Person Header & Stats */}
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={item.owner} size="md" />
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">
                        {item.owner}
                      </h3>
                      <span className="text-[12px] text-ink-faint">Team member</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[12px] tabular-nums">
                    <span className="text-green bg-green-tint px-2 py-0.5 rounded-[4px] border border-green/30">
                      {item.stats?.done || 0} done
                    </span>
                    <span className="text-ink-soft bg-fill px-2 py-0.5 rounded-[4px] border border-line">
                      {item.stats?.pending || 0} pending
                    </span>
                    {(item.stats?.overdue || 0) > 0 && (
                      <span className="text-red bg-red-tint px-2 py-0.5 rounded-[4px] border border-red/30 font-medium">
                        {item.stats.overdue} overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Executive Summary */}
                {item.summary && (
                  <div className="text-[13px] text-ink leading-relaxed bg-fill p-3 rounded-[6px]">
                    <strong className="text-ink block mb-1 text-[12px]">Executive summary:</strong>
                    {item.summary}
                  </div>
                )}

                {/* Highlights */}
                {item.highlights && item.highlights.length > 0 && (
                  <div className="space-y-1 text-[13px]">
                    <span className="text-[12px] font-medium text-ink-soft block">
                      Key commitments:
                    </span>
                    <ul className="list-disc pl-5 space-y-0.5 text-ink">
                      {item.highlights.map((h, hIdx) => (
                        <li key={hIdx}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Existing Outbox Digests Timeline */}
      <section className="space-y-3">
        <h2 className="text-[17px] font-semibold text-ink">
          Pending or sent summaries
        </h2>

        {existingOutboxDigests.length === 0 ? (
          <p className="text-[13px] text-ink-faint italic py-4">
            No weekly summaries queued. Click "Generate weekly summaries" above to compile.
          </p>
        ) : (
          <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
            {existingOutboxDigests.map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between gap-4 text-[13px]">
                <div className="space-y-1">
                  <div className="font-semibold text-ink flex items-center gap-2">
                    <span>{item.title}</span>
                    <StampBadge status={item.status} />
                  </div>
                  <p className="text-ink-soft line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>
                </div>
                <div className="text-[11px] text-ink-faint shrink-0 tabular-nums">
                  {new Date(item.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
