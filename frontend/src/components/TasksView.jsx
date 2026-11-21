import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  User,
  Calendar,
  AlertCircle,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  Quote,
  Search,
  GitBranch,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export default function TasksView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [integrations, setIntegrations] = useState({ trello: false, webhook: false });

  const fetchTasks = (owner = '') => {
    setLoading(true);
    const url = owner ? `/api/tasks?owner=${encodeURIComponent(owner)}` : '/api/tasks';
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setTasks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching tasks:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTasks(ownerFilter);
    fetch('/api/integrations/status')
      .then((res) => res.json())
      .then((data) => setIntegrations(data))
      .catch(() => {});
  }, [ownerFilter]);

  const allOwners = Array.from(
    new Set(
      tasks
        .map((t) => t.owner)
        .filter((o) => o && o.trim())
    )
  ).sort();

  const handleStatusChange = async (taskId, newStatus) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: updated.status } : t))
        );
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchOwner = (t.owner || '').toLowerCase().includes(q);
      const matchMeeting = (t.meeting_title || '').toLowerCase().includes(q);
      const matchDep = (t.depends_on_title || '').toLowerCase().includes(q);
      return matchTitle || matchOwner || matchMeeting || matchDep;
    }
    return true;
  });

  const totalCount = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-emerald-400" />
            Execution Tasks Board
          </h2>
          <p className="text-sm text-slate-400">
            Track commitments, dependencies, and execution status across all meetings.
          </p>
        </div>

        {/* Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {!integrations.trello && (
            <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px]">
              Internal tracker mode (Trello not configured)
            </span>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-medium">
            Total: <span className="font-bold text-white">{totalCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Pending: <span className="font-bold text-white">{pendingCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Done: <span className="font-bold">{doneCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 font-medium flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5" />
            Blocked: <span className="font-bold">{blockedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tasks, owners, dependencies, meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Owners</option>
            {allOwners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Task Cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm italic">
          Loading tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 p-8 space-y-3">
          <CheckSquare className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-300">No tasks found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {tasks.length === 0
              ? 'Analyze a meeting transcript in the "New Meeting" view to extract and save action items.'
              : 'Try adjusting your search or filters to see more tasks.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 bg-slate-900 border rounded-2xl space-y-3 shadow-md hover:border-slate-700 transition-all ${
                task.status === 'blocked'
                  ? 'border-rose-900/60 bg-rose-950/10'
                  : task.status === 'done'
                  ? 'border-emerald-900/50 bg-emerald-950/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-white tracking-tight">
                      {task.title}
                    </h4>
                    {task.needs_clarification && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        Needs Clarification
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span className="text-indigo-400 font-medium">
                      Created in: {task.meeting_title}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span>Date: {task.meeting_date}</span>

                    {/* Updated in Meeting Tag */}
                    {task.updated_in_meeting_title && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-950/70 text-blue-300 border border-blue-800/80 font-medium flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 text-blue-400" />
                          Updated in: {task.updated_in_meeting_title}
                        </span>
                      </>
                    )}
                  </p>

                  {/* Waits for Dependency Badge */}
                  {task.depends_on_title && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/50 text-cyan-300 border border-cyan-800/60 text-xs font-medium">
                      <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Waits for: <strong>{task.depends_on_title}</strong></span>
                    </div>
                  )}
                </div>

                {/* Status Dropdown */}
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">
                    Status:
                  </span>
                  <select
                    value={task.status}
                    disabled={updatingTaskId === task.id}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer transition-colors ${
                      task.status === 'done'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                        : task.status === 'blocked'
                        ? 'bg-rose-950/90 text-rose-300 border-rose-700'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <option value="pending" className="bg-slate-900 text-slate-300">
                      Pending
                    </option>
                    <option value="done" className="bg-slate-900 text-emerald-300">
                      Done
                    </option>
                    <option value="blocked" className="bg-slate-900 text-rose-300">
                      Blocked
                    </option>
                  </select>
                </div>
              </div>

              {/* Task Attributes Row */}
              <div className="flex items-center gap-4 text-xs flex-wrap pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-500">Owner:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-md ${
                      task.owner
                        ? 'bg-slate-800 text-slate-200 border border-slate-700'
                        : 'bg-amber-950 text-amber-300 border border-amber-800 italic'
                    }`}
                  >
                    {task.owner || 'Unassigned'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-500">Deadline:</span>
                  <span
                    className={`font-mono ${
                      task.deadline ? 'text-slate-200' : 'text-slate-500 italic'
                    }`}
                  >
                    {task.deadline || 'No deadline'}
                  </span>
                </div>

                {task.trello_url && (
                  <a
                    href={task.trello_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <span>Open in Trello</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 ml-auto">
                  <span className="font-mono">
                    {Math.round(task.confidence * 100)}% conf
                  </span>
                </div>
              </div>

              {/* Status Evidence Quote (if task was updated in later meeting) */}
              {task.status_evidence && (
                <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs italic text-blue-200/90 font-serif flex items-start gap-2">
                  <Quote className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>Update Evidence: "{task.status_evidence}"</span>
                </div>
              )}

              {/* Original Evidence Quote */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs italic text-slate-400 font-serif flex items-start gap-2">
                <Quote className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>Original Evidence: "{task.evidence_quote}"</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
