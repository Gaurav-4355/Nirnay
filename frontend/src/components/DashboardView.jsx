import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Compass,
  CheckSquare,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  User,
  Calendar,
  AlertCircle,
  HelpCircle,
  Play,
  Activity,
  Layers,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export default function DashboardView({ onStartDemo, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = () => {
    setLoading(true);
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching dashboard data:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-slate-900 rounded-xl animate-pulse"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-900/60 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const workload = data?.workload || [];
  const upcoming = data?.upcoming_deadlines || [];
  const chains = data?.decision_chains || [];
  const radar = data?.conflict_radar || {};
  const activities = data?.recent_activity || [];

  const isEmpty = !kpis.meetings_count && !kpis.total_tasks;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-400" />
            Executive Operations Dashboard
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status across meetings, cross-meeting decision chains, owner workload, and deadline execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onStartDemo && (
            <button
              onClick={onStartDemo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-950 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Guided Demo</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {isEmpty ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4 max-w-xl mx-auto my-12">
          <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center mx-auto text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Meeting Data Yet</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Analyze your first meeting transcript or launch the Guided Demo mode to see cross-meeting memory, decision changes, workload charts, and conflict detection in action.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            {onStartDemo && (
              <button
                onClick={onStartDemo}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950"
              >
                Launch Guided Demo
              </button>
            )}
            {onNavigate && (
              <button
                onClick={() => onNavigate('new_meeting')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Analyze Transcript
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Top KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Meetings */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Meetings</span>
              <div className="text-2xl font-black text-white font-mono">{kpis.meetings_count}</div>
              <p className="text-[10px] text-slate-400">Processed</p>
            </div>

            {/* Active Decisions */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Active Decisions</span>
              <div className="text-2xl font-black text-white font-mono">{kpis.active_decisions_count}</div>
              <p className="text-[10px] text-slate-400">Current policies</p>
            </div>

            {/* Completion Rate */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Completion</span>
              <div className="text-2xl font-black text-white font-mono">{kpis.completion_rate}%</div>
              <p className="text-[10px] text-slate-400">{kpis.done_tasks}/{kpis.total_tasks} tasks done</p>
            </div>

            {/* Overdue */}
            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Overdue</span>
              <div className="text-2xl font-black text-rose-400 font-mono">{kpis.overdue_tasks}</div>
              <p className="text-[10px] text-rose-300/80">Need escalation</p>
            </div>

            {/* Due Next 7 Days */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Due in 7 Days</span>
              <div className="text-2xl font-black text-white font-mono">{kpis.due_next_7_days}</div>
              <p className="text-[10px] text-slate-400">Upcoming horizon</p>
            </div>

            {/* Active Conflicts */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Conflicts</span>
              <div className="text-2xl font-black text-white font-mono">{kpis.total_conflicts}</div>
              <p className="text-[10px] text-slate-400">{kpis.unresolved_conflicts} unresolved</p>
            </div>

            {/* Clarification */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Clarifications</span>
              <div className="text-2xl font-black text-white font-mono">{kpis.clarification_count}</div>
              <p className="text-[10px] text-slate-400">Unclear scope/owner</p>
            </div>
          </div>

          {/* Main Grid: Workload (Plain SVG/CSS) + Decision Memory */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Team Workload Stacked Bars (Plain SVG/CSS) */}
            <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-400" />
                    Team Workload & Capacity
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Stacked active commitments per owner. Threshold: 3+ tasks in 7 days indicates overload.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span> Pending
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Blocked
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Done
                  </span>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {workload.map((w, idx) => {
                  const total = w.pending + w.blocked + w.done;
                  const pPct = total > 0 ? (w.pending / total) * 100 : 0;
                  const bPct = total > 0 ? (w.blocked / total) * 100 : 0;
                  const dPct = total > 0 ? (w.done / total) * 100 : 0;

                  return (
                    <div key={idx} className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">@{w.owner}</span>
                          {w.is_overloaded && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                              OVERLOADED ({w.due_next_7_days} in 7d)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {w.pending} pending · {w.blocked} blocked · {w.done} done
                        </span>
                      </div>

                      {/* Plain SVG / CSS Stacked Bar */}
                      <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex shadow-inner">
                        {pPct > 0 && (
                          <div
                            style={{ width: `${pPct}%` }}
                            className="bg-indigo-500 transition-all duration-500"
                            title={`Pending: ${w.pending}`}
                          />
                        )}
                        {bPct > 0 && (
                          <div
                            style={{ width: `${bPct}%` }}
                            className="bg-rose-500 transition-all duration-500"
                            title={`Blocked: ${w.blocked}`}
                          />
                        )}
                        {dPct > 0 && (
                          <div
                            style={{ width: `${dPct}%` }}
                            className="bg-emerald-500 transition-all duration-500"
                            title={`Done: ${w.done}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Decision Memory Chains */}
            <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  Cross-Meeting Decision Memory
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ordered evolution chains per topic showing how policies and dates shifted across meetings.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {chains.map((chainItem, cIdx) => (
                  <div
                    key={cIdx}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 font-mono">
                      Topic: {chainItem.topic}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {chainItem.chain.map((step, sIdx) => {
                        const isLast = sIdx === chainItem.chain.length - 1;
                        const isSuperseded = step.status === 'superseded';

                        return (
                          <React.Fragment key={sIdx}>
                            <div
                              className={`p-2.5 rounded-xl border flex flex-col gap-0.5 ${
                                isLast && !isSuperseded
                                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                                  : 'bg-slate-900/90 border-slate-800 text-slate-400 line-through'
                              }`}
                            >
                              <span className="font-bold text-xs">{step.value}</span>
                              <span className="text-[10px] text-slate-400 no-underline font-mono">
                                {step.meeting_title} ({step.meeting_date})
                              </span>
                            </div>

                            {sIdx < chainItem.chain.length - 1 && (
                              <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Lower Grid: Upcoming Deadlines + Conflict Radar & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Upcoming Deadlines (2 cols) */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    Next 10 Upcoming Deadlines
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Evaluated relative to simulated today ({data.today}).
                  </p>
                </div>
              </div>

              {upcoming.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6">No upcoming deadlines.</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {upcoming.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-medium text-white truncate max-w-sm">
                          {task.title}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-indigo-300 font-semibold shrink-0">
                          @{task.owner}
                        </span>
                        {task.trello_url && (
                          <a
                            href={task.trello_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 shrink-0"
                          >
                            <span>Trello</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {task.deadline}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                            task.is_overdue
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : task.days_left <= 2
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {task.is_overdue
                            ? `${Math.abs(task.days_left)}d overdue`
                            : task.days_left === 0
                            ? 'due today'
                            : `${task.days_left}d left`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conflict Radar & Recent Activity Feed (1 col) */}
            <div className="space-y-6">
              
              {/* Conflict Radar */}
              <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Conflict Radar
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-300">Decision Overrides</span>
                    <span className="font-mono font-bold text-amber-400">{radar.decision_conflict || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-300">Workload Overloads</span>
                    <span className="font-mono font-bold text-rose-400">{radar.workload_overload || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-300">Dependency Clashes</span>
                    <span className="font-mono font-bold text-cyan-400">{radar.dependency_conflict || 0}</span>
                  </div>
                </div>
              </div>

              {/* Activity Feed */}
              <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Recent Operations Feed
                </h3>
                <div className="space-y-2 text-xs max-h-60 overflow-y-auto pr-1">
                  {activities.map((act, aIdx) => (
                    <div
                      key={aIdx}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-0.5"
                    >
                      <div className="font-semibold text-white text-[11px] truncate">
                        {act.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {act.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </>
      )}
    </div>
  );
}
