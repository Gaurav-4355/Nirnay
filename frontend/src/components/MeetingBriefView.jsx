import React, { useState, useEffect } from 'react';
import {
  Printer,
  Sparkles,
  Calendar,
  Clock,
  User,
  CheckSquare,
  AlertTriangle,
  Ban,
  GitBranch,
  HelpCircle,
  Compass,
  RefreshCw,
  FileText,
} from 'lucide-react';

export default function MeetingBriefView() {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBrief = () => {
    setLoading(true);
    fetch('/api/brief')
      .then((res) => res.json())
      .then((data) => {
        setBrief(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching brief:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBrief();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-3 text-xs text-slate-400">Compiling meeting brief...</p>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="p-8 text-center text-slate-400">
        Failed to load meeting brief. Please try refreshing.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            Executive Meeting Brief
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Pre-meeting context pack with decisions, ownership commitments, risk items, and suggested agenda.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBrief}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Brief Document Container */}
      <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-8 shadow-xl print:p-0 print:border-none print:bg-white print:text-black print:shadow-none">
        
        {/* Document Header */}
        <div className="pb-6 border-b border-slate-800 print:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 print:text-indigo-700">
                NIRNAY • EXECUTIVE BRIEF
              </span>
              <span className="text-slate-600 print:text-slate-400">•</span>
              <span className="text-xs font-mono text-slate-400 print:text-slate-600">
                Date: {brief.today}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white print:text-black mt-1">
              Cross-Meeting Operations Brief
            </h1>
          </div>

          {brief.last_meeting && (
            <div className="text-right sm:text-right text-xs text-slate-400 print:text-slate-600">
              <div className="font-semibold text-slate-200 print:text-black">
                Last Meeting: {brief.last_meeting.title}
              </div>
              <div className="text-[11px] text-slate-500 print:text-slate-500">
                Conducted: {brief.last_meeting.date}
              </div>
            </div>
          )}
        </div>

        {/* AI Suggested Agenda Items */}
        {brief.suggested_agenda && brief.suggested_agenda.length > 0 && (
          <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-900/40 print:bg-slate-50 print:border-slate-300 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 print:text-indigo-800">
              <Sparkles className="w-4 h-4 text-indigo-400 print:text-indigo-700" />
              <span>Suggested Agenda & Discussion Focus</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-200 print:text-slate-800">
              {brief.suggested_agenda.map((agenda, aIdx) => (
                <li key={aIdx} className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold mt-0.5">•</span>
                  <span className="leading-relaxed">{agenda}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Critical Alerts Row: Overdue, Blocked, Needs Clarification */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overdue */}
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 print:bg-slate-50 print:border-slate-300 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-rose-400 print:text-rose-700 uppercase tracking-wide">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Overdue Tasks
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 font-mono text-[10px] border border-rose-800 print:bg-rose-100 print:text-rose-900 print:border-rose-300">
                {brief.overdue_tasks?.length || 0}
              </span>
            </div>
            {brief.overdue_tasks?.length === 0 ? (
              <p className="text-[11px] text-slate-500 print:text-slate-500 italic">No overdue tasks.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {brief.overdue_tasks.map((t) => (
                  <li key={t.id} className="text-slate-300 print:text-slate-800 border-b border-rose-950/40 pb-1">
                    <strong className="block text-white print:text-black">{t.title}</strong>
                    <div className="flex items-center justify-between text-[10px] text-rose-400/90 print:text-rose-700">
                      <span>@{t.owner || 'Unassigned'}</span>
                      <span className="font-mono">Due: {t.deadline}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Blocked */}
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-900/40 print:bg-slate-50 print:border-slate-300 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 print:text-amber-800 uppercase tracking-wide">
              <span className="flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" />
                Blocked Tasks
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 font-mono text-[10px] border border-amber-800 print:bg-amber-100 print:text-amber-900 print:border-amber-300">
                {brief.blocked_tasks?.length || 0}
              </span>
            </div>
            {brief.blocked_tasks?.length === 0 ? (
              <p className="text-[11px] text-slate-500 print:text-slate-500 italic">No blocked tasks.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {brief.blocked_tasks.map((t) => (
                  <li key={t.id} className="text-slate-300 print:text-slate-800 border-b border-amber-950/40 pb-1">
                    <strong className="block text-white print:text-black">{t.title}</strong>
                    <div className="flex items-center justify-between text-[10px] text-amber-400/90 print:text-amber-800">
                      <span>@{t.owner || 'Unassigned'}</span>
                      <span>Blocked</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Clarification */}
          <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-900/40 print:bg-slate-50 print:border-slate-300 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-blue-400 print:text-blue-800 uppercase tracking-wide">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                Needs Clarification
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 font-mono text-[10px] border border-blue-800 print:bg-blue-100 print:text-blue-900 print:border-blue-300">
                {brief.clarification_tasks?.length || 0}
              </span>
            </div>
            {brief.clarification_tasks?.length === 0 ? (
              <p className="text-[11px] text-slate-500 print:text-slate-500 italic">All task owners & scopes clear.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {brief.clarification_tasks.map((t) => (
                  <li key={t.id} className="text-slate-300 print:text-slate-800 border-b border-blue-950/40 pb-1">
                    <strong className="block text-white print:text-black">{t.title}</strong>
                    {t.clarification_question && (
                      <p className="text-[11px] text-blue-300 print:text-blue-700 italic">
                        "{t.clarification_question}"
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Dependencies at Risk */}
        {brief.dependencies_at_risk && brief.dependencies_at_risk.length > 0 && (
          <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-900/40 print:bg-slate-50 print:border-slate-300 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 print:text-cyan-800">
              <GitBranch className="w-4 h-4 text-cyan-400 print:text-cyan-700" />
              <span>Dependencies at Risk ({brief.dependencies_at_risk.length})</span>
            </div>
            <div className="space-y-2">
              {brief.dependencies_at_risk.map((dep, dIdx) => (
                <div
                  key={dIdx}
                  className="p-3 rounded-xl bg-slate-950/50 print:bg-white border border-cyan-900/30 print:border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-white print:text-black">
                      '{dep.task_title}'
                    </span>{' '}
                    <span className="text-slate-400 print:text-slate-600">
                      waits for prerequisite
                    </span>{' '}
                    <strong className="text-cyan-300 print:text-cyan-800">
                      '{dep.depends_on_task_title}'
                    </strong>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 print:bg-rose-100 print:text-rose-900">
                    Reason: {dep.risk_reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Decisions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 border-b border-slate-800 print:border-slate-300 pb-2">
            <span className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400 print:text-amber-700" />
              Active System Decisions ({brief.active_decisions?.length || 0})
            </span>
            <span className="text-[11px] font-normal text-slate-500 print:text-slate-500 lowercase">
              ({brief.superseded_decisions_count || 0} superseded)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(brief.active_decisions || []).map((dec) => (
              <div
                key={dec.id}
                className="p-3.5 rounded-xl bg-slate-950/60 print:bg-white border border-slate-800 print:border-slate-200 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase font-bold text-indigo-400 print:text-indigo-700">
                    {dec.topic}
                  </span>
                  <span className="font-semibold text-emerald-400 print:text-emerald-700 text-xs">
                    {dec.value}
                  </span>
                </div>
                <p className="text-slate-200 print:text-slate-800 font-medium">{dec.text}</p>
                {dec.evidence_quote && (
                  <p className="text-[11px] italic text-slate-400 print:text-slate-600 font-serif">
                    "{dec.evidence_quote}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Open Tasks by Owner */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 border-b border-slate-800 print:border-slate-300 pb-2 flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
            <span>Open Tasks by Team Member</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(brief.open_tasks_by_owner || {}).map(([owner, tasks]) => (
              <div
                key={owner}
                className="p-4 rounded-xl bg-slate-950/50 print:bg-white border border-slate-800 print:border-slate-200 space-y-2.5"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 print:border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white print:text-black">
                    <User className="w-3.5 h-3.5 text-indigo-400 print:text-indigo-700" />
                    <span>@{owner}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 print:text-slate-600">
                    {tasks.length} open
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="p-2 rounded-lg bg-slate-900/60 print:bg-slate-50 border border-slate-800/80 print:border-slate-200 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-slate-200 print:text-slate-800 truncate">
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                        <span
                          className={
                            task.status === 'blocked'
                              ? 'text-rose-400 font-bold'
                              : 'text-slate-400'
                          }
                        >
                          {task.status}
                        </span>
                        {task.deadline && (
                          <span className="text-slate-500 print:text-slate-600">{task.deadline}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
