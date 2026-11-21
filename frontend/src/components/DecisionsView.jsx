import React, { useState, useEffect } from 'react';
import {
  Compass,
  Search,
  Quote,
  Calendar,
  Layers,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { formatTopic } from '../ui/tokens';
import StampBadge from '../ui/StampBadge';
import RedPenStrike from '../ui/RedPenStrike';
import TranscriptDrawer from '../ui/TranscriptDrawer';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import ErrorAlert from '../ui/ErrorAlert';

export default function DecisionsView() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchTopic, setSearchTopic] = useState('');
  const [selectedQuote, setSelectedQuote] = useState(null); // { quote, meetingTitle, meetingDate, transcript }
  const [meetingsCache, setMeetingsCache] = useState({});

  const fetchDecisions = () => {
    setLoading(true);
    setErrorMsg(null);
    Promise.all([
      fetch('/api/decisions').then((res) => {
        if (!res.ok) throw new Error('Failed to load decisions');
        return res.json();
      }),
      fetch('/api/meetings').then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([decData, meetData]) => {
        setDecisions(Array.isArray(decData) ? decData : []);
        if (Array.isArray(meetData)) {
          const cache = {};
          meetData.forEach((m) => {
            cache[m.id] = m;
          });
          setMeetingsCache(cache);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching decisions:', err);
        setErrorMsg('Unable to retrieve decision history from server.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDecisions();
  }, []);

  const handleOpenQuoteDrawer = (d) => {
    const meeting = meetingsCache[d.meeting_id] || {};
    setSelectedQuote({
      quote: d.evidence_quote,
      meetingTitle: d.meeting_title,
      meetingDate: d.meeting_date,
      transcript: meeting.transcript || '',
    });
  };

  const filteredDecisions = decisions.filter((d) => {
    if (!searchTopic.trim()) return true;
    const term = searchTopic.toLowerCase();
    return (
      d.topic.toLowerCase().includes(term) ||
      d.text.toLowerCase().includes(term) ||
      d.value.toLowerCase().includes(term) ||
      (d.meeting_title || '').toLowerCase().includes(term)
    );
  });

  // Group by topic
  const groupedByTopic = filteredDecisions.reduce((acc, d) => {
    const topic = d.topic.trim().toLowerCase();
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(d);
    return acc;
  }, {});

  // Sort each group: active on top, newest ID first
  Object.keys(groupedByTopic).forEach((topic) => {
    groupedByTopic[topic].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return (b.id || 0) - (a.id || 0);
    });
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-stone-700" />
            Decision Ledger
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Official chronological ledger of agreed parameters across meetings with audit tracking for superseded decisions.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search topic or value..."
            value={searchTopic}
            onChange={(e) => setSearchTopic(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
      </div>

      {errorMsg && <ErrorAlert message={errorMsg} onRetry={fetchDecisions} />}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : decisions.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No decisions in ledger yet"
          description="Analyze and confirm a meeting transcript to extract organizational decisions into the ledger."
        />
      ) : Object.keys(groupedByTopic).length === 0 ? (
        <div className="text-center py-12 text-stone-500 text-xs">
          No decisions match your search filter "{searchTopic}".
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByTopic).map(([topic, decs]) => (
            <div
              key={topic}
              className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs"
            >
              {/* Ledger Section Header */}
              <div className="px-5 py-3 bg-[#f7f6f2] border-b border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-stone-700"></span>
                  <h3 className="text-xs font-semibold text-stone-900">
                    {formatTopic(topic)}
                  </h3>
                </div>
                <span className="text-[11px] text-stone-500">
                  {decs.length} {decs.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {/* Table Ledger Rows */}
              <div className="divide-y divide-stone-100">
                {decs.map((d) => {
                  const isSuperseded = d.status === 'superseded';
                  return (
                    <div
                      key={d.id}
                      className={`px-5 py-3.5 flex flex-col md:flex-row md:items-start justify-between gap-4 transition-colors ${
                        isSuperseded ? 'bg-stone-50/50 hover:bg-stone-50' : 'hover:bg-stone-50/60'
                      }`}
                    >
                      {/* Left: Value, status, description, and replacement audit note */}
                      <div className="space-y-1.5 flex-1 max-w-xl">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {isSuperseded ? (
                            <RedPenStrike className="font-semibold text-sm">
                              {d.value}
                            </RedPenStrike>
                          ) : (
                            <span className="font-bold text-sm text-stone-900">
                              {d.value}
                            </span>
                          )}

                          <StampBadge status={d.status} />

                          {d.confidence && (
                            <span className="text-[10px] text-stone-400">
                              {Math.round(d.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>

                        <p className={`text-xs ${isSuperseded ? 'text-stone-500' : 'text-stone-700'}`}>
                          {d.text}
                        </p>

                        {/* Replaced on <date> in <meeting> */}
                        {isSuperseded && (
                          <div className="pt-1 flex items-center gap-1.5 text-xs text-red-700 font-medium">
                            <ArrowRight className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>
                              Replaced by {d.superseded_by_value || 'newer decision'}
                              {d.superseded_by_meeting_title && (
                                <span className="text-stone-600">
                                  {' '}
                                  in {d.superseded_by_meeting_title}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Middle: Meeting Context */}
                      <div className="text-xs text-stone-500 md:text-right shrink-0 space-y-0.5">
                        <div className="font-medium text-stone-800 flex items-center md:justify-end gap-1">
                          <Calendar className="w-3 h-3 text-stone-400" />
                          <span>{d.meeting_date}</span>
                        </div>
                        <p className="text-[11px] text-stone-500 max-w-[200px] truncate" title={d.meeting_title}>
                          {d.meeting_title}
                        </p>
                      </div>

                      {/* Right: Who said it - Quote Button */}
                      <div className="md:max-w-xs shrink-0 pt-0.5">
                        <button
                          onClick={() => handleOpenQuoteDrawer(d)}
                          className="w-full text-left group border-l-2 border-[#e7e9ee] hover:border-[#1e35c7] pl-2.5 py-1 text-xs transition-colors rounded-r hover:bg-[#f7f8fa]"
                          title="Click to view quotation in transcript"
                        >
                          <div className="flex items-center gap-1 text-[10px] text-[#8a90a2] group-hover:text-[#1e35c7] mb-0.5">
                            <Quote className="w-2.5 h-2.5" />
                            <span>Evidence citation</span>
                          </div>
                          <p className="font-serif italic text-stone-700 group-hover:text-stone-900 line-clamp-2">
                            "{d.evidence_quote}"
                          </p>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transcript Drawer Modal */}
      <TranscriptDrawer
        isOpen={Boolean(selectedQuote)}
        onClose={() => setSelectedQuote(null)}
        meetingTitle={selectedQuote?.meetingTitle}
        meetingDate={selectedQuote?.meetingDate}
        transcript={selectedQuote?.transcript}
        highlightQuote={selectedQuote?.quote}
      />
    </div>
  );
}
