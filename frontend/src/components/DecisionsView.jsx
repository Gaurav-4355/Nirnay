import React, { useState, useEffect } from 'react';
import {
  Compass,
  Calendar,
  Quote,
  CheckCircle2,
  Clock,
  Search,
  Layers,
  ArrowRight,
  Ban,
} from 'lucide-react';

export default function DecisionsView() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTopic, setSearchTopic] = useState('');

  const fetchDecisions = () => {
    setLoading(true);
    fetch('/api/decisions')
      .then((res) => res.json())
      .then((data) => {
        setDecisions(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching decisions:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDecisions();
  }, []);

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

  const grouped = filteredDecisions.reduce((acc, d) => {
    const key = `${d.meeting_id}___${d.meeting_title}___${d.meeting_date}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const renderConfidence = (conf) => {
    const pct = Math.round(conf * 100);
    return (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
        {pct}% conf
      </span>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-400" />
            Decisions Timeline
          </h2>
          <p className="text-sm text-slate-400">
            Chronological log of all confirmed decisions across meetings with superseded history tracking.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search topic, value or meeting..."
            value={searchTopic}
            onChange={(e) => setSearchTopic(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm italic">
          Loading decisions timeline...
        </div>
      ) : decisions.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 p-8 space-y-3">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-300">No decisions saved yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Analyze a meeting transcript in the "New Meeting" tab and click "Confirm & Save" to build your organization's decision history.
          </p>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No decisions match your search filter "{searchTopic}".
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([meetingKey, decs]) => {
            const [, meetingTitle, meetingDate] = meetingKey.split('___');
            return (
              <div key={meetingKey} className="space-y-4">
                {/* Meeting Group Header */}
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-950"></div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {meetingTitle}
                  </h3>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    {meetingDate}
                  </span>
                  <span className="text-xs text-slate-500">
                    ({decs.length} {decs.length === 1 ? 'decision' : 'decisions'})
                  </span>
                </div>

                {/* Cards for this meeting */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-slate-800 ml-1.5">
                  {decs.map((d) => {
                    const isSuperseded = d.status === 'superseded';
                    return (
                      <div
                        key={d.id}
                        className={`p-4 rounded-2xl space-y-3 shadow-md transition-all border ${
                          isSuperseded
                            ? 'bg-slate-950/60 border-slate-800/60 opacity-60'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                                isSuperseded
                                  ? 'bg-slate-900 text-slate-500 border border-slate-800 line-through'
                                  : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800'
                              }`}
                            >
                              {d.topic}
                            </span>
                            <span
                              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
                                isSuperseded
                                  ? 'bg-slate-900 text-slate-500 border border-slate-800 line-through'
                                  : 'bg-slate-800 text-amber-300 border border-slate-700'
                              }`}
                            >
                              {d.value}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                                isSuperseded
                                  ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              }`}
                            >
                              {d.status}
                            </span>
                            {renderConfidence(d.confidence)}
                          </div>
                        </div>

                        {/* Struck-through text if superseded */}
                        <p
                          className={`text-sm font-medium ${
                            isSuperseded ? 'text-slate-400 line-through' : 'text-slate-200'
                          }`}
                        >
                          {d.text}
                        </p>

                        {/* Superseded replacement banner */}
                        {isSuperseded && (
                          <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-900/50 text-xs text-amber-300/90 flex items-center gap-2 font-medium">
                            <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>
                              Replaced by: <strong>{d.superseded_by_value || 'New Decision'}</strong>
                              {d.superseded_by_meeting_title && ` (${d.superseded_by_meeting_title})`}
                            </span>
                          </div>
                        )}

                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs italic text-slate-400 font-serif">
                          <div className="flex items-center gap-1 text-[10px] font-mono not-italic text-slate-500 mb-0.5">
                            <Quote className="w-3 h-3 text-indigo-400" />
                            Evidence:
                          </div>
                          "{d.evidence_quote}"
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
