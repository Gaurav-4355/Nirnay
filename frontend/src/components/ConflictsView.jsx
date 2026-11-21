import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Calendar,
  Search,
  Shuffle,
  Users,
  GitBranch,
  ArrowRight,
  Layers,
  Clock,
} from 'lucide-react';
import StampBadge from '../ui/StampBadge';
import RedPenStrike from '../ui/RedPenStrike';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import ErrorAlert from '../ui/ErrorAlert';

export default function ConflictsView() {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchConflicts = () => {
    setLoading(true);
    setErrorMsg(null);
    fetch('/api/conflicts')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load conflicts');
        return res.json();
      })
      .then((data) => {
        setConflicts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching conflicts:', err);
        setErrorMsg('Unable to retrieve conflicts log from server.');
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

  // --- Visual Treatment 1: Decision Conflict (Before / After Diff) ---
  const renderDecisionDiff = (c) => {
    // Extract values from description or related titles
    const desc = c.description || '';
    const match = desc.match(/changed from\s+(.*?)\s+\((.*?)\)\s+to\s+(.*?)$/i);
    let oldVal = 'Previous decision';
    let oldContext = 'Earlier meeting';
    let newVal = 'New decision';

    if (match) {
      oldVal = match[1];
      oldContext = match[2];
      newVal = match[3];
    } else {
      const parts = desc.split('to');
      if (parts.length === 2) {
        oldVal = parts[0].replace(/.*from/i, '').trim();
        newVal = parts[1].trim();
      }
    }

    return (
      <div className="mt-3 p-3.5 bg-stone-50 border border-stone-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Before */}
        <div className="space-y-0.5">
          <span className="text-[10px] font-medium text-stone-500">Before</span>
          <div className="font-semibold text-stone-700">
            <RedPenStrike>{oldVal}</RedPenStrike>
          </div>
          <p className="text-[11px] text-stone-400">{oldContext}</p>
        </div>

        <ArrowRight className="w-4 h-4 text-stone-400 shrink-0 hidden sm:block" />

        {/* After */}
        <div className="space-y-0.5 sm:text-right">
          <span className="text-[10px] font-medium text-emerald-700">After (Agreed)</span>
          <div className="font-bold text-sm text-stone-900">{newVal}</div>
          <p className="text-[11px] text-stone-500">
            {c.meeting_title} ({c.meeting_date})
          </p>
        </div>
      </div>
    );
  };

  // --- Visual Treatment 2: Workload Overload (7-Day Strip) ---
  const renderWorkloadStrip = (c) => {
    // Extract dates and owner from description
    const desc = c.description || '';
    const dateMatch = desc.match(/between\s+([0-9-]+)\s+and\s+([0-9-]+)/i);
    const startDateStr = dateMatch ? dateMatch[1] : '2026-12-24';

    // Generate 7 consecutive days starting from startDate
    const days = [];
    const baseDate = new Date(startDateStr);
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const isOverloadedDay = i >= 0 && i <= 3; // Dense commitment window
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr: d.toISOString().split('T')[0].slice(5), // MM-DD
        isOverloaded: isOverloadedDay,
      });
    }

    return (
      <div className="mt-3 p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span className="font-medium text-stone-800">7-day capacity timeline</span>
          <span className="text-[11px] text-amber-700 font-medium">Overload threshold: 4+ tasks / 7 days</span>
        </div>

        {/* 7 Day cells */}
        <div className="grid grid-cols-7 gap-1.5 pt-1">
          {days.map((day, idx) => (
            <div
              key={idx}
              className={`p-2 rounded border text-center transition-all ${
                day.isOverloaded
                  ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold shadow-2xs'
                  : 'bg-white border-stone-200 text-stone-500'
              }`}
            >
              <div className="text-[10px] text-stone-400 font-normal">{day.label}</div>
              <div className="text-xs mt-0.5">{day.dateStr}</div>
              {day.isOverloaded && (
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-600 mx-auto"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Visual Treatment 3: Dependency Conflict (Two tasks on timeline) ---
  const renderDependencyTimeline = (c) => {
    const desc = c.description || '';
    // E.g. "Karan's '...' is due 2026-12-22 but depends on Amit's '...' due 2026-12-28"
    const dates = desc.match(/[0-9]{4}-[0-9]{2}-[0-9]{2}/g) || ['2026-12-22', '2026-12-28'];
    const taskDate = dates[0] || '2026-12-22';
    const depDate = dates[1] || '2026-12-28';

    return (
      <div className="mt-3 p-3.5 bg-stone-50 border border-stone-200 rounded-lg space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-stone-800">Timeline sequence clash</span>
          <span className="text-[11px] text-red-700 font-medium">
            Prerequisite finishes after dependent task
          </span>
        </div>

        {/* Horizontal Timeline Track */}
        <div className="relative pt-3 pb-2">
          <div className="h-1 bg-stone-200 rounded-full w-full"></div>
          <div className="absolute top-2.5 left-1/4 right-1/4 h-1 bg-red-400 rounded-full"></div>

          <div className="flex items-start justify-between pt-3">
            {/* Downstream Task */}
            <div className="space-y-0.5 max-w-[200px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                <span className="text-xs font-semibold text-stone-900">{taskDate}</span>
              </div>
              <p className="text-[11px] text-stone-600">Dependent task scheduled completion</p>
            </div>

            {/* Prerequisite Task */}
            <div className="space-y-0.5 text-right max-w-[200px]">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-xs font-semibold text-stone-900">{depDate}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-stone-700"></span>
              </div>
              <p className="text-[11px] text-stone-600">Prerequisite deliverable due date</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-stone-700" />
            Detected Conflicts Log
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Deterministic cross-meeting discrepancies detected across decision revisions, team capacity limits, and deliverable dependencies.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search conflicts..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
      </div>

      {errorMsg && <ErrorAlert message={errorMsg} onRetry={fetchConflicts} />}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : conflicts.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No conflicts detected"
          description="When you analyze meetings that alter previous decisions, overload team members, or violate task dependencies, conflicts will be recorded here with resolutions."
        />
      ) : filteredConflicts.length === 0 ? (
        <div className="text-center py-12 text-stone-500 text-xs">
          No conflicts match your search filter "{searchFilter}".
        </div>
      ) : (
        <div className="space-y-4">
          {filteredConflicts.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs space-y-3"
            >
              {/* Top row: Type indicator, Title, and Stamp Status */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 flex items-center gap-1.5">
                      {c.type === 'decision_conflict' && <Shuffle className="w-3 h-3 text-stone-600" />}
                      {c.type === 'workload_overload' && <Users className="w-3 h-3 text-stone-600" />}
                      {c.type === 'dependency_conflict' && <GitBranch className="w-3 h-3 text-stone-600" />}
                      <span>{c.type.replace('_', ' ')}</span>
                    </span>
                    <h3 className="text-sm font-bold text-stone-900">{c.title}</h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed font-sans">{c.description}</p>
                </div>

                <div className="shrink-0">
                  <StampBadge status={c.resolution || 'unresolved'} />
                </div>
              </div>

              {/* Three Visual Treatments */}
              {c.type === 'decision_conflict' && renderDecisionDiff(c)}
              {c.type === 'workload_overload' && renderWorkloadStrip(c)}
              {c.type === 'dependency_conflict' && renderDependencyTimeline(c)}

              {/* Footer Audit Context */}
              <div className="flex items-center gap-3 text-xs text-stone-400 pt-2 border-t border-stone-100 flex-wrap">
                <span className="font-medium text-stone-700">{c.meeting_title}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-stone-400" />
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
