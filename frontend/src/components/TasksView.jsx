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
  Kanban,
  Table as TableIcon,
  Layers,
} from 'lucide-react';

export default function TasksView({ showToast }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'table'
  const [integrations, setIntegrations] = useState({ trello: false, webhook: false });
  const [todayStr, setTodayStr] = useState('');
  const [dragOverCol, setDragOverCol] = useState(null);

  const fetchTasks = (owner = '') => {
    setLoading(true);
    let url = '/api/tasks';
    if (owner === '__unassigned__') {
      url = '/api/tasks?owner=unassigned';
    } else if (owner) {
      url = `/api/tasks?owner=${encodeURIComponent(owner)}`;
    }
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setTasks(Array.isArray(data) ? data : []);
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
    fetch('/api/settings/today')
      .then((res) => res.json())
      .then((data) => setTodayStr(data.today || ''))
      .catch(() => {});
  }, [ownerFilter]);

  const allOwners = Array.from(
    new Set(
      tasks
        .map((t) => t.owner)
        .filter((o) => o && o.trim())
    )
  ).sort();

  const unassignedCount = tasks.filter((t) => !t.owner || !t.owner.trim()).length;

  const handleStatusChange = async (taskId, newStatus) => {
    const originalTask = tasks.find((t) => t.id === taskId);
    if (!originalTask || originalTask.status === newStatus) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
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
        if (showToast) {
          showToast(`Task moved to ${newStatus}. Outbox tracker updated.`, 'success');
        }
      } else {
        // Rollback
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? originalTask : t))
        );
        if (showToast) showToast('Failed to update task status. Rolled back.', 'error');
      }
    } catch (err) {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? originalTask : t))
      );
      if (showToast) showToast('Network error updating task.', 'error');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colStatus) {
      setDragOverCol(colStatus);
    }
  };

  const handleDragLeave = (e, colStatus) => {
    if (dragOverCol === colStatus) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e, colStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskIdStr = e.dataTransfer.getData('text/plain');
    const taskId = parseInt(taskIdStr, 10);
    if (!isNaN(taskId)) {
      handleStatusChange(taskId, colStatus);
    }
  };

  const getOwnerColor = (name) => {
    if (!name) return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
    const colorPairs = [
      'bg-indigo-950 text-indigo-300 border-indigo-700',
      'bg-purple-950 text-purple-300 border-purple-700',
      'bg-emerald-950 text-emerald-300 border-emerald-700',
      'bg-amber-950 text-amber-300 border-amber-700',
      'bg-rose-950 text-rose-300 border-rose-700',
      'bg-cyan-950 text-cyan-300 border-cyan-700',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colorPairs[Math.abs(hash) % colorPairs.length];
  };

  const getDeadlineBadge = (deadline, status) => {
    if (!deadline) return <span className="text-slate-500 italic text-[11px]">No deadline</span>;
    if (status === 'done') return <span className="text-slate-400 font-mono text-[11px]">{deadline}</span>;

    let diff = null;
    if (todayStr) {
      const todayDate = new Date(todayStr);
      const taskDate = new Date(deadline);
      diff = Math.round((taskDate - todayDate) / (1000 * 60 * 60 * 24));
    }

    if (diff !== null && diff < 0) {
      return (
        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
          Overdue ({Math.abs(diff)}d ago)
        </span>
      );
    }
    if (diff !== null && diff <= 2) {
      return (
        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
          Due in {diff === 0 ? 'today' : `${diff}d`}
        </span>
      );
    }

    return (
      <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
        <Calendar className="w-3 h-3 text-slate-500" />
        {deadline}
      </span>
    );
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (ownerFilter === '__unassigned__' && t.owner && t.owner.trim()) return false;
    if (ownerFilter && ownerFilter !== '__unassigned__' && t.owner !== ownerFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchOwner = (t.owner || 'unassigned').toLowerCase().includes(q);
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

  const kanbanColumns = [
    { id: 'pending', title: 'Pending', count: pendingCount, border: 'border-indigo-500/40', bg: 'bg-indigo-950/20' },
    { id: 'blocked', title: 'Blocked', count: blockedCount, border: 'border-rose-500/40', bg: 'bg-rose-950/20' },
    { id: 'done', title: 'Done', count: doneCount, border: 'border-emerald-500/40', bg: 'bg-emerald-950/20' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-emerald-400" />
            Execution Tasks Board
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Track commitments, drag cards across status columns, and keep Trello trackers in sync.
          </p>
        </div>

        {/* View Toggle & Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {!integrations.trello && (
            <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px]">
              Internal tracker mode (Trello not configured)
            </span>
          )}

          {/* Table | Board Toggle */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'board'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Owner Filter Chips Row */}
      <div className="flex items-center gap-2 flex-wrap pb-1 text-xs">
        <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" />
          Filter Owner:
        </span>
        <button
          onClick={() => setOwnerFilter('')}
          className={`px-3 py-1 rounded-xl font-semibold transition-all ${
            !ownerFilter
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          All ({totalCount})
        </button>
        {allOwners.map((owner) => {
          const count = tasks.filter((t) => t.owner === owner).length;
          return (
            <button
              key={owner}
              onClick={() => setOwnerFilter(ownerFilter === owner ? '' : owner)}
              className={`px-3 py-1 rounded-xl font-semibold transition-all ${
                ownerFilter === owner
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              @{owner} ({count})
            </button>
          );
        })}
        {unassignedCount > 0 && (
          <button
            onClick={() => setOwnerFilter(ownerFilter === '__unassigned__' ? '' : '__unassigned__')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all flex items-center gap-1 ${
              ownerFilter === '__unassigned__'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950 font-bold'
                : 'bg-slate-900 text-amber-400/90 hover:bg-slate-800 hover:text-amber-300 border border-slate-800'
            }`}
          >
            <span>Unassigned ({unassignedCount})</span>
          </button>
        )}
      </div>

      {/* Main Board vs Table Area */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-xs text-slate-400">Loading execution tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
          <CheckSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white">No tasks found</h4>
          <p className="text-xs text-slate-400 mt-1">Analyze a meeting to extract actionable tasks.</p>
        </div>
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {kanbanColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            const isHovered = dragOverCol === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={(e) => handleDragLeave(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`p-4 rounded-3xl bg-slate-900/50 border transition-all min-h-[500px] flex flex-col space-y-3 ${
                  isHovered ? 'border-indigo-400 ring-2 ring-indigo-500/30 bg-slate-900/90' : col.border
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        col.id === 'done'
                          ? 'bg-emerald-400'
                          : col.id === 'blocked'
                          ? 'bg-rose-400'
                          : 'bg-indigo-400'
                      }`}
                    />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      {col.title}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 font-bold border border-slate-700">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  {colTasks.length === 0 ? (
                    <div className="py-12 text-center text-[11px] text-slate-600 border border-dashed border-slate-800/80 rounded-2xl">
                      Drop tasks here
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3 cursor-grab active:cursor-grabbing shadow-sm"
                      >
                        {/* Title */}
                        <div className="text-xs font-semibold text-white leading-snug">
                          {task.title}
                        </div>

                        {/* Owner Badge & Deadlines */}
                        <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-800/60 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {task.owner ? (
                              <>
                                <span
                                  className={`w-6 h-6 rounded-lg text-[10px] font-bold border flex items-center justify-center ${getOwnerColor(
                                    task.owner
                                  )}`}
                                >
                                  {task.owner.slice(0, 2).toUpperCase()}
                                </span>
                                <span className="text-[11px] font-medium text-slate-300">
                                  @{task.owner}
                                </span>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1">
                                <User className="w-3 h-3 text-amber-400" />
                                Unassigned
                              </span>
                            )}
                          </div>

                          <div>{getDeadlineBadge(task.deadline, task.status)}</div>
                        </div>

                        {/* Dependency Badge */}
                        {task.depends_on_title && (
                          <div className="text-[10px] px-2 py-1 rounded-lg bg-cyan-950/40 text-cyan-300 border border-cyan-800/60 flex items-center gap-1 truncate">
                            <GitBranch className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">Waits for: {task.depends_on_title}</span>
                          </div>
                        )}

                        {/* Trello Link & Needs Clarification */}
                        <div className="flex items-center justify-between text-[10px] pt-1 text-slate-500">
                          {task.needs_clarification ? (
                            <span className="text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Clarification
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-slate-600">
                              {task.meeting_title ? task.meeting_title.slice(0, 18) + '...' : ''}
                            </span>
                          )}

                          {task.trello_url && (
                            <a
                              href={task.trello_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>Trello</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white tracking-tight">{task.title}</h4>
                    {task.needs_clarification && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        Needs Clarification
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span className="text-indigo-400">Meeting: {task.meeting_title}</span>
                    <span>•</span>
                    <span>Date: {task.meeting_date}</span>
                    {task.depends_on_title && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-400 flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          Waits for: {task.depends_on_title}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  <select
                    value={task.status}
                    disabled={updatingTaskId === task.id}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${
                      task.status === 'done'
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                        : task.status === 'blocked'
                        ? 'bg-rose-950/90 text-rose-300 border-rose-700'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <option value="pending" className="bg-slate-900 text-slate-300">Pending</option>
                    <option value="done" className="bg-slate-900 text-emerald-300">Done</option>
                    <option value="blocked" className="bg-slate-900 text-rose-300">Blocked</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs flex-wrap pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Owner:</span>
                  {task.owner ? (
                    <span className={`font-semibold px-2 py-0.5 rounded-md ${getOwnerColor(task.owner)}`}>
                      @{task.owner}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1">
                      <User className="w-3 h-3 text-amber-400" />
                      Unassigned
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Deadline:</span>
                  {getDeadlineBadge(task.deadline, task.status)}
                </div>
                {task.trello_url && (
                  <a
                    href={task.trello_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-800/60 px-2 py-0.5 rounded-md"
                  >
                    <span>Open in Trello</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
