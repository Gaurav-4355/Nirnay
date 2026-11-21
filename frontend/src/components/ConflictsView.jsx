import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Shuffle,
  Users,
  GitBranch,
} from 'lucide-react';

export default function ConflictsView() {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchConflicts = () => {
    setLoading(true);
    fetch('/api/conflicts')
      .then((res) => res.json())
      .then((data) => {
        setConflicts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching conflicts:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const filteredConflicts = conflicts.filter((c) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      c.title.toLowerCase().includes(term) ||
      c.description.toLowerCase().includes(term) ||
      (c.meeting_title || '').toLowerCase().includes(term) ||
      (c.type || '').toLowerCase().includes(term)
    );
  });

  const getConflictIcon = (type) => {
    if (type === 'decision_conflict') {
      return <Shuffle className="w-4 h-4 text-amber-400" />;
    }
    if (type === 'workload_overload') {
      return <Users className="w-4 h-4 text-rose-400" />;
    }
    return <GitBranch className="w-4 h-4 text-cyan-400" />;
  };

  const getResolutionBadge = (res) => {
    if (res === 'kept_new') {
      return (
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Kept New Decision
        </span>
      );
    }
    if (res === 'kept_old') {
      return (
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Kept Old Decision
        </span>
      );
    }
    if (res === 'acknowledged') {
      return (
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Acknowledged
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
        Pending Resolution
      </span>
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
            Detected Conflicts Log
          </h2>
          <p className="text-sm text-slate-400">
            Cross-meeting discrepancies detected and resolved during execution planning.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search conflict, topic, or meeting..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm italic">
          Loading conflicts log...
        </div>
      ) : conflicts.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 p-8 space-y-3">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-300">No conflicts recorded yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            When you analyze meetings that alter previous decisions, overload team members, or violate task dependencies, conflicts will be detected and logged here upon confirmation.
          </p>
        </div>
      ) : filteredConflicts.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No conflicts match your search filter "{searchFilter}".
        </div>
      ) : (
        <div className="space-y-4">
          {filteredConflicts.map((c) => (
            <div
              key={c.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl space-y-3.5 shadow-md transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold">
                    {getConflictIcon(c.type)}
                    <span className="capitalize text-slate-300">
                      {c.type.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {c.title}
                  </h3>
                </div>

                <div>{getResolutionBadge(c.resolution)}</div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {c.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-800/80">
                <span className="flex items-center gap-1 text-indigo-400 font-medium">
                  {c.meeting_title}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Meeting Date: {c.meeting_date}
                </span>
                <span>•</span>
                <span>Detected on: {new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
