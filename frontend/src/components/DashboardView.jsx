import React, { useState, useEffect } from 'react';
import {
  Compass,
  CheckSquare,
  AlertTriangle,
  Send,
  User,
  Clock,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Play,
  CheckCircle2,
} from 'lucide-react';
import RedPenStrike from '../ui/RedPenStrike';
import Avatar from '../ui/Avatar';
import StampBadge from '../ui/StampBadge';

export default function DashboardView({ onStartDemo, onNavigate }) {
  const [data, setData] = useState(null);
  const [outboxPendingCount, setOutboxPendingCount] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/dashboard').then((r) => r.json()).catch(() => ({})),
      fetch('/api/outbox?status=pending').then((r) => r.json()).catch(() => []),
      fetch('/api/tasks').then((r) => r.json()).catch(() => []),
    ])
      .then(([dash, pendingOutbox, allTasks]) => {
        setData(dash);
        setOutboxPendingCount(Array.isArray(pendingOutbox) ? pendingOutbox.length : 0);
        const unassigned = Array.isArray(allTasks)
          ? allTasks.filter(
              (t) =>
                t.status !== 'done' &&
                (!t.owner || t.owner.toLowerCase() === 'unassigned' || t.needs_clarification)
            ).length
          : 0;
        setUnassignedCount(unassigned);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching dashboard data:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-[1200px] mx-auto space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-fill rounded-[6px]"></div>
        <div className="h-32 bg-fill rounded-[10px] border border-line"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-64 bg-fill rounded-[10px]"></div>
          <div className="h-64 bg-fill rounded-[10px]"></div>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const workload = data?.workload || [];
  const upcoming = data?.upcoming_deadlines || [];
  const chains = data?.decision_chains || [];
  const activities = data?.recent_activity || [];
  const todayStr = data?.today || new Date().toISOString().split('T')[0];

  const unsettledConflicts = kpis.unresolved_conflicts || 0;
  const totalCallsWaiting = unsettledConflicts + outboxPendingCount + unassignedCount;
  const isEmpty = !kpis.meetings_count && !kpis.total_tasks;

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-10 bg-surface">
      {/* Page Title & Date Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 pb-4 border-b border-line">
        <div>
          <h1 className="text-[30px] font-bold text-ink tracking-[-0.02em] leading-tight">
            Today
          </h1>
          <p className="text-[13px] text-ink-soft mt-0.5 tabular-nums">
            {todayStr} · Status across meetings, living decision memory, and execution horizon.
          </p>
        </div>
      </div>

      {/* Empty State */}
      {isEmpty ? (
        <div className="py-16 text-center max-w-[560px] mx-auto space-y-4">
          <div className="w-12 h-12 rounded-[10px] bg-fill border border-line flex items-center justify-center mx-auto text-accent-text">
            <Compass className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[22px] font-semibold text-ink">
              Paste your first meeting
            </h2>
            <p className="text-[15px] text-ink-soft leading-relaxed">
              Analyze a spoken or written transcript to extract decisions, assign tasks, and establish cross-meeting memory.
            </p>
          </div>
          <div className="pt-3 flex items-center justify-center gap-3">
            {onNavigate && (
              <button
                onClick={() => onNavigate('new_meeting')}
                className="px-4 py-2 rounded-[6px] text-[14px] font-semibold bg-accent hover:bg-accent-hover text-white transition-colors"
              >
                Read a meeting
              </button>
            )}
            {onStartDemo && (
              <button
                onClick={onStartDemo}
                className="px-4 py-2 rounded-[6px] text-[14px] font-medium bg-surface hover:bg-fill text-ink border border-line transition-colors"
              >
                Load demo meetings
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Section: Needs your call (HERO LEDGER) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-ink">
                Needs your call
              </h2>
              {totalCallsWaiting === 0 ? (
                <span className="text-[13px] text-green font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Nothing waiting. Your meetings are up to date.
                </span>
              ) : (
                <span className="text-[13px] text-amber font-medium tabular-nums">
                  {totalCallsWaiting} {totalCallsWaiting === 1 ? 'item requires' : 'items require'} attention
                </span>
              )}
            </div>

            <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
              {unsettledConflicts > 0 && (
                <div className="py-3 flex items-center justify-between text-[15px]">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#d0272d]"></span>
                    <span className="text-ink font-medium tabular-nums">
                      {unsettledConflicts} {unsettledConflicts === 1 ? 'conflict' : 'conflicts'} to settle
                    </span>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('conflicts')}
                      className="px-3 py-1 rounded-[6px] text-[13px] font-medium text-accent-text hover:bg-accent-tint transition-colors"
                    >
                      Review
                    </button>
                  )}
                </div>
              )}

              {outboxPendingCount > 0 && (
                <div className="py-3 flex items-center justify-between text-[15px]">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#b26b00]"></span>
                    <span className="text-ink font-medium tabular-nums">
                      {outboxPendingCount} {outboxPendingCount === 1 ? 'message' : 'messages'} waiting for approval
                    </span>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('outbox')}
                      className="px-3 py-1 rounded-[6px] text-[13px] font-medium text-accent-text hover:bg-accent-tint transition-colors"
                    >
                      Approve
                    </button>
                  )}
                </div>
              )}

              {unassignedCount > 0 && (
                <div className="py-3 flex items-center justify-between text-[15px]">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#b26b00]"></span>
                    <span className="text-ink font-medium tabular-nums">
                      {unassignedCount} {unassignedCount === 1 ? 'task' : 'tasks'} without an owner
                    </span>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('tasks')}
                      className="px-3 py-1 rounded-[6px] text-[13px] font-medium text-accent-text hover:bg-accent-tint transition-colors"
                    >
                      Assign
                    </button>
                  )}
                </div>
              )}

              {totalCallsWaiting === 0 && (
                <div className="py-3 text-[14px] text-ink-soft">
                  No unresolved conflicts, pending approval messages, or unassigned tasks.
                </div>
              )}
            </div>
          </section>

          {/* Section: Decision Ledger (Wide Left) & Who is loaded (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Decision Ledger (7 cols) */}
            <section className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-ink">
                  Decision ledger
                </h2>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('decisions')}
                    className="text-[13px] text-accent-text hover:underline font-medium"
                  >
                    View all decisions
                  </button>
                )}
              </div>

              {chains.length === 0 ? (
                <p className="text-[13px] text-ink-faint italic py-4">No decisions recorded yet.</p>
              ) : (
                <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
                  {chains.slice(0, 6).map((item, idx) => {
                    const activeStep = item.chain[item.chain.length - 1];
                    const pastSteps = item.chain.slice(0, -1);

                    return (
                      <div key={idx} className="py-3 flex flex-col md:flex-row md:items-baseline justify-between gap-2 text-[14px]">
                        <div className="w-36 shrink-0 font-medium text-ink">
                          {item.topic.replace(/_/g, ' ')}
                        </div>
                        <div className="flex-1 flex items-baseline gap-2 flex-wrap">
                          {pastSteps.map((s, sIdx) => (
                            <span key={sIdx} className="inline-flex items-baseline gap-1 text-ink-faint">
                              <RedPenStrike>{s.value}</RedPenStrike>
                              <span className="text-ink-faint">→</span>
                            </span>
                          ))}
                          <span className="font-semibold text-ink">
                            {activeStep?.value}
                          </span>
                        </div>
                        <div className="text-[12px] text-ink-faint tabular-nums shrink-0">
                          {activeStep?.meeting_date}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Who is loaded (5 cols) */}
            <section className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-ink">
                  Who is loaded
                </h2>
                <span className="text-[12px] text-ink-faint">Threshold: 3+ due in 7d</span>
              </div>

              {workload.length === 0 ? (
                <p className="text-[13px] text-ink-faint italic py-4">No owner commitments tracked.</p>
              ) : (
                <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
                  {workload.map((w, idx) => {
                    const dueCount = w.due_next_7_days || 0;
                    const maxBar = 6;
                    const filledBars = Math.min(dueCount, maxBar);
                    const isOver = w.is_overloaded;

                    return (
                      <div key={idx} className="py-3 flex items-center justify-between gap-4 text-[14px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={w.owner} size="sm" />
                          <span className="font-medium text-ink truncate">
                            {w.owner}
                          </span>
                        </div>

                        {/* Plain SVG workload bar with threshold indicator */}
                        <div className="flex items-center gap-3">
                          <svg className="w-24 h-3 shrink-0" viewBox="0 0 100 12" fill="none">
                            {/* Background track */}
                            <rect x="0" y="2" width="100" height="8" rx="2" fill="#F7F8FA" stroke="#E7E9EE" strokeWidth="1" />
                            {/* Filled active capacity */}
                            <rect
                              x="0"
                              y="2"
                              width={Math.min(100, (dueCount / 5) * 100)}
                              height="8"
                              rx="2"
                              fill={isOver ? '#D0272D' : '#1E35C7'}
                            />
                            {/* 3+ threshold marker line at 60% */}
                            <line x1="60" y1="0" x2="60" y2="12" stroke="#CDD1DA" strokeWidth="1.5" strokeDasharray="2 2" />
                          </svg>

                          <span
                            className={`text-[12px] font-medium tabular-nums min-w-[70px] text-right ${
                              isOver ? 'text-red' : 'text-ink-soft'
                            }`}
                          >
                            {dueCount} due in 7d
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Section: Coming up (Next 10 deadlines) & Recently (Short activity list) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Coming up (7 cols) */}
            <section className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold text-ink">
                  Coming up
                </h2>
                <span className="text-[12px] text-ink-soft">Next 10 deadlines</span>
              </div>

              {upcoming.length === 0 ? (
                <p className="text-[13px] text-ink-faint italic py-4">No upcoming deadlines.</p>
              ) : (
                <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
                  {upcoming.map((task) => (
                    <div
                      key={task.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-[14px]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={task.owner} size="xs" />
                        <span className="font-medium text-ink truncate max-w-sm">
                          {task.title}
                        </span>
                        {task.trello_url && (
                          <a
                            href={task.trello_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-text hover:underline inline-flex items-center gap-0.5 text-[12px] shrink-0"
                          >
                            <span>Trello</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        <span className="text-[12px] text-ink-soft">
                          {task.deadline}
                        </span>
                        {task.is_overdue ? (
                          <span className="text-[12px] font-medium text-red bg-red-tint px-1.5 py-0.5 rounded-[4px] border border-red/30">
                            {Math.abs(task.days_left)}d overdue
                          </span>
                        ) : task.days_left <= 2 ? (
                          <span className="text-[12px] font-medium text-amber bg-amber-tint px-1.5 py-0.5 rounded-[4px] border border-amber/30">
                            {task.days_left === 0 ? 'due today' : `${task.days_left}d left`}
                          </span>
                        ) : (
                          <span className="text-[12px] text-ink-faint">
                            {task.days_left}d left
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recently (5 cols) */}
            <section className="lg:col-span-5 space-y-3">
              <h2 className="text-[17px] font-semibold text-ink">
                Recently
              </h2>

              {activities.length === 0 ? (
                <p className="text-[13px] text-ink-faint italic py-4">No recent activity.</p>
              ) : (
                <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
                  {activities.slice(0, 6).map((act, aIdx) => (
                    <div key={aIdx} className="py-2.5 space-y-0.5 text-[13px]">
                      <div className="font-medium text-ink truncate">
                        {act.title}
                      </div>
                      <div className="text-[12px] text-ink-soft truncate">
                        {act.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
