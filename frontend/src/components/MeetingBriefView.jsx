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
} from 'lucide-react';
import Avatar from '../ui/Avatar';
import StampBadge from '../ui/StampBadge';

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
        <div className="w-6 h-6 border-2 border-[#1e35c7] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-3 text-[13px] text-[#5e6477]">Compiling next meeting brief...</p>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="p-8 text-center text-[#5e6477] text-[14px]">
        Failed to load meeting brief. Please try refreshing.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[760px] mx-auto space-y-8 bg-white">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b border-[#e7e9ee] print:hidden">
        <div>
          <h1 className="text-[30px] font-bold text-[#0f1222] tracking-[-0.02em] leading-tight">
            Next meeting brief
          </h1>
          <p className="text-[13px] text-[#5e6477] mt-0.5">
            Pre-meeting context pack with decisions, ownership commitments, risk items, and suggested agenda.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchBrief}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium bg-white hover:bg-[#f7f8fa] text-[#0f1222] border border-[#e7e9ee] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#5e6477]" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-1.5 rounded-[6px] text-[13px] font-semibold bg-[#1e35c7] hover:bg-[#172aa3] text-white transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print or save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Brief Document Container */}
      <div className="space-y-8 print:p-0 print:border-none print:bg-white print:text-black">
        {/* Document Header */}
        <div className="pb-4 border-b border-[#e7e9ee] flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <div className="text-[12px] font-semibold text-[#1e35c7]">
              NIRNAY EXECUTIVE BRIEF
            </div>
            <h2 className="text-[22px] font-bold text-[#0f1222] mt-0.5">
              Cross-Meeting Operations Brief
            </h2>
          </div>

          <div className="text-right text-[12px] text-[#5e6477] tabular-nums">
            <div>Brief date: {brief.today}</div>
            {brief.last_meeting && (
              <div>Last meeting: {brief.last_meeting.title} ({brief.last_meeting.date})</div>
            )}
          </div>
        </div>

        {/* AI Suggested Agenda Items */}
        {brief.suggested_agenda && brief.suggested_agenda.length > 0 && (
          <section className="p-4 rounded-[8px] bg-[#f7f8fa] border border-[#e7e9ee] space-y-2">
            <div className="text-[13px] font-semibold text-[#0f1222] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#1e35c7]" />
              <span>Suggested agenda & discussion focus</span>
            </div>
            <ul className="space-y-1.5 text-[13px] text-[#0f1222] pl-5 list-disc leading-relaxed">
              {brief.suggested_agenda.map((agenda, aIdx) => (
                <li key={aIdx}>{agenda}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Critical Alerts: Overdue, Blocked, Needs Clarification */}
        <section className="space-y-3">
          <h3 className="text-[15px] font-semibold text-[#0f1222]">
            Critical attention items
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overdue */}
            <div className="p-3.5 rounded-[8px] bg-white border border-[#e7e9ee] space-y-2">
              <div className="flex items-center justify-between text-[13px] font-semibold text-[#d0272d]">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Overdue tasks
                </span>
                <span className="text-[12px] tabular-nums">
                  {brief.overdue_tasks?.length || 0}
                </span>
              </div>
              {brief.overdue_tasks?.length === 0 ? (
                <p className="text-[12px] text-[#8a90a2] italic">No overdue tasks.</p>
              ) : (
                <ul className="space-y-1.5 text-[13px]">
                  {brief.overdue_tasks.map((t) => (
                    <li key={t.id} className="border-b border-[#e7e9ee] pb-1">
                      <strong className="block text-[#0f1222] text-[13px]">{t.title}</strong>
                      <div className="flex items-center justify-between text-[11px] text-[#5e6477] tabular-nums">
                        <span>@{t.owner || 'Unassigned'}</span>
                        <span className="text-[#d0272d]">Due: {t.deadline}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Blocked */}
            <div className="p-3.5 rounded-[8px] bg-white border border-[#e7e9ee] space-y-2">
              <div className="flex items-center justify-between text-[13px] font-semibold text-[#d0272d]">
                <span className="flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" />
                  Blocked tasks
                </span>
                <span className="text-[12px] tabular-nums">
                  {brief.blocked_tasks?.length || 0}
                </span>
              </div>
              {brief.blocked_tasks?.length === 0 ? (
                <p className="text-[12px] text-[#8a90a2] italic">No blocked tasks.</p>
              ) : (
                <ul className="space-y-1.5 text-[13px]">
                  {brief.blocked_tasks.map((t) => (
                    <li key={t.id} className="border-b border-[#e7e9ee] pb-1">
                      <strong className="block text-[#0f1222] text-[13px]">{t.title}</strong>
                      <div className="flex items-center justify-between text-[11px] text-[#5e6477]">
                        <span>@{t.owner || 'Unassigned'}</span>
                        <span className="text-[#d0272d]">Blocked</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Clarification */}
            <div className="p-3.5 rounded-[8px] bg-white border border-[#e7e9ee] space-y-2">
              <div className="flex items-center justify-between text-[13px] font-semibold text-[#b26b00]">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Needs clarification
                </span>
                <span className="text-[12px] tabular-nums">
                  {brief.clarification_tasks?.length || 0}
                </span>
              </div>
              {brief.clarification_tasks?.length === 0 ? (
                <p className="text-[12px] text-[#8a90a2] italic">All task owners & scopes clear.</p>
              ) : (
                <ul className="space-y-1.5 text-[13px]">
                  {brief.clarification_tasks.map((t) => (
                    <li key={t.id} className="border-b border-[#e7e9ee] pb-1">
                      <strong className="block text-[#0f1222] text-[13px]">{t.title}</strong>
                      {t.clarification_question && (
                        <p className="text-[11px] text-[#b26b00] italic font-serif">
                          "{t.clarification_question}"
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Dependencies at Risk */}
        {brief.dependencies_at_risk && brief.dependencies_at_risk.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[15px] font-semibold text-[#0f1222] flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-[#1e35c7]" />
              <span>Dependencies at risk ({brief.dependencies_at_risk.length})</span>
            </h3>
            <div className="space-y-2">
              {brief.dependencies_at_risk.map((dep, dIdx) => (
                <div
                  key={dIdx}
                  className="p-3 rounded-[6px] bg-[#f7f8fa] border border-[#e7e9ee] text-[13px] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-[#0f1222]">
                      '{dep.task_title}'
                    </span>{' '}
                    <span className="text-[#5e6477]">
                      waits for prerequisite
                    </span>{' '}
                    <strong className="text-[#0f1222]">
                      '{dep.depends_on_task_title}'
                    </strong>
                  </div>
                  <span className="text-[12px] font-medium text-[#d0272d] tabular-nums">
                    {dep.risk_reason}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active Decisions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-[#e7e9ee]">
            <h3 className="text-[15px] font-semibold text-[#0f1222]">
              Active decisions ({brief.active_decisions?.length || 0})
            </h3>
            <span className="text-[12px] text-[#8a90a2] tabular-nums">
              {brief.superseded_decisions_count || 0} superseded
            </span>
          </div>

          <div className="divide-y divide-[#e7e9ee]">
            {(brief.active_decisions || []).map((dec) => (
              <div key={dec.id} className="py-2.5 flex flex-col md:flex-row md:items-baseline justify-between gap-2 text-[14px]">
                <div className="w-36 shrink-0 font-medium text-[#0f1222]">
                  {dec.topic?.replace(/_/g, ' ')}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="font-semibold text-[#0f1222]">{dec.value}</div>
                  {dec.evidence_quote && (
                    <p className="text-[12px] font-serif italic text-[#5e6477]">
                      "{dec.evidence_quote}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Open Tasks by Owner */}
        <section className="space-y-3">
          <div className="pb-1 border-b border-[#e7e9ee]">
            <h3 className="text-[15px] font-semibold text-[#0f1222]">
              Open tasks by team member
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(brief.open_tasks_by_owner || {}).map(([owner, tasks]) => (
              <div
                key={owner}
                className="p-4 rounded-[8px] bg-white border border-[#e7e9ee] space-y-2.5"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[#e7e9ee]">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0f1222]">
                    <Avatar name={owner} size="xs" />
                    <span>{owner}</span>
                  </div>
                  <span className="text-[11px] text-[#5e6477] tabular-nums">
                    {tasks.length} open
                  </span>
                </div>

                <ul className="space-y-1.5 text-[13px]">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 py-1 text-[13px]"
                    >
                      <span className="text-[#0f1222] truncate">{task.title}</span>
                      <div className="flex items-center gap-2 shrink-0 text-[11px] tabular-nums text-[#5e6477]">
                        <span>{task.status}</span>
                        {task.deadline && <span>{task.deadline}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
