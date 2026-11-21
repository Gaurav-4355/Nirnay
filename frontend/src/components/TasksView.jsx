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
  Search,
  GitBranch,
  RefreshCw,
  ExternalLink,
  Kanban,
  Table as TableIcon,
  GripVertical,
  ArrowUpDown,
  UserPlus,
} from 'lucide-react';
import StampBadge from '../ui/StampBadge';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import ErrorAlert from '../ui/ErrorAlert';

export default function TasksView({ showToast }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  // Remember view mode in URL hash (#board | #table)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'table' || hash === 'board') return hash;
    }
    return 'board';
  });

  const [deadlineSortAsc, setDeadlineSortAsc] = useState(true);
  const [integrations, setIntegrations] = useState({ trello: false, webhook: false });
  const [todayStr, setTodayStr] = useState('');
  const [dragOverCol, setDragOverCol] = useState(null);
  const [assigningTaskId, setAssigningTaskId] = useState(null);
  const [assignOwnerInput, setAssignOwnerInput] = useState('');

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      window.location.hash = mode;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'table' || hash === 'board') {
        setViewMode(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const fetchTasks = (owner = '') => {
    setLoading(true);
    setErrorMsg(null);
    let url = '/api/tasks';
    if (owner === '__unassigned__') {
      url = '/api/tasks?owner=unassigned';
    } else if (owner) {
      url = `/api/tasks?owner=${encodeURIComponent(owner)}`;
    }
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load tasks');
        return res.json();
      })
      .then((data) => {
        setTasks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching tasks:', err);
        setErrorMsg('Unable to load execution tasks from server.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTasks(ownerFilter);
    fetch('/api/integrations/status')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setIntegrations(data))
      .catch(() => {});
    fetch('/api/settings/today')
      .then((res) => (res.ok ? res.json() : {}))
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
        if (showToast) showToast('Failed to update task status.', 'error');
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

  const handleAssignOwner = async (taskId) => {
    const newOwner = assignOwnerInput.trim();
    if (!newOwner) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: newOwner, needs_clarification: false }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, owner: updated.owner, needs_clarification: updated.needs_clarification } : t))
        );
        setAssigningTaskId(null);
        setAssignOwnerInput('');
        if (showToast) showToast(`Assigned to @${newOwner}`, 'success');
      }
    } catch (e) {
      if (showToast) showToast('Failed to assign owner.', 'error');
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

  const getDeadlineBadge = (deadline, status) => {
    if (!deadline) return <span className="text-stone-400 italic text-xs">No deadline</span>;
    if (status === 'done') return <span className="text-stone-500 text-xs font-sans">{deadline}</span>;

    let diff = null;
    if (todayStr) {
      const todayDate = new Date(todayStr);
      const taskDate = new Date(deadline);
      diff = Math.round((taskDate - todayDate) / (1000 * 60 * 60 * 24));
    }

    if (diff !== null && diff < 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-800 border border-red-200">
          Overdue ({Math.abs(diff)}d ago)
        </span>
      );
    }
    if (diff !== null && diff <= 2) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
          Due in {diff === 0 ? 'today' : `${diff}d`}
        </span>
      );
    }

    return (
      <span className="text-stone-600 text-xs flex items-center gap-1 font-sans">
        <Calendar className="w-3 h-3 text-stone-400" />
        {deadline}
      </span>
    );
  };

  const filteredTasks = tasks.filter((t) => {
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

  // Table sorting by deadline
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return deadlineSortAsc
      ? a.deadline.localeCompare(b.deadline)
      : b.deadline.localeCompare(a.deadline);
  });

  const totalCount = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;

  const kanbanColumns = [
    {
      id: 'pending',
      title: 'Pending',
      count: pendingCount,
      headerStyle: 'bg-stone-100/70 border-stone-200 text-stone-800',
      dotColor: 'bg-stone-500',
    },
    {
      id: 'blocked',
      title: 'Blocked',
      count: blockedCount,
      headerStyle: 'bg-red-50/70 border-red-200 text-red-900',
      dotColor: 'bg-red-600',
    },
    {
      id: 'done',
      title: 'Done',
      count: doneCount,
      headerStyle: 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
      dotColor: 'bg-emerald-600',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-stone-700" />
            Execution Tasks
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Track commitments across meetings, update statuses via drag & drop or dense table view, and sync to external trackers.
          </p>
        </div>

        {/* View Toggle & Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {!integrations.trello && (
            <span className="px-2.5 py-1 rounded bg-stone-100 border border-stone-200 text-stone-600 text-xs">
              Internal tracker mode
            </span>
          )}

          {/* Table | Board Toggle (URL hash remembered) */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <button
              onClick={() => handleSetViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'board'
                  ? 'bg-surface text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => handleSetViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-surface text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && <ErrorAlert message={errorMsg} onRetry={() => fetchTasks(ownerFilter)} />}

      {/* Owner Filter Chips Row */}
      <div className="flex items-center gap-2 flex-wrap pb-1 text-xs">
        <span className="text-stone-500 font-medium shrink-0 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-stone-400" />
          Filter:
        </span>
        <button
          onClick={() => setOwnerFilter('')}
          className={`px-3 py-1 rounded-lg font-medium transition-all ${
            !ownerFilter
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'bg-surface text-stone-700 hover:bg-stone-100 border border-stone-200'
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
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                ownerFilter === owner
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'bg-surface text-stone-700 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              @{owner} ({count})
            </button>
          );
        })}
        {unassignedCount > 0 && (
          <button
            onClick={() => setOwnerFilter(ownerFilter === '__unassigned__' ? '' : '__unassigned__')}
            className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
              ownerFilter === '__unassigned__'
                ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
            }`}
          >
            <span>Unassigned ({unassignedCount})</span>
          </button>
        )}
      </div>

      {/* Main Board vs Table Area */}
      {loading ? (
        <LoadingSkeleton rows={5} type={viewMode === 'board' ? 'cards' : 'ledger'} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks recorded yet"
          description="Analyze meeting transcripts to automatically extract actionable tasks and assignees."
        />
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
                className={`p-3.5 rounded-xl border transition-all min-h-[500px] flex flex-col space-y-3 bg-[#f7f6f2] ${
                  isHovered ? 'border-stone-400 ring-2 ring-stone-300 bg-stone-100' : 'border-stone-200'
                }`}
              >
                {/* Column Header with restrained color */}
                <div
                  className={`px-3 py-2 rounded-lg border flex items-center justify-between ${col.headerStyle}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <h3 className="text-xs font-semibold text-stone-900">{col.title}</h3>
                  </div>
                  <span className="text-xs font-sans text-stone-500 font-medium">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                  {colTasks.length === 0 ? (
                    <div className="py-12 text-center text-xs text-stone-400 border border-dashed border-stone-200 rounded-lg">
                      Drop tasks here
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="group relative p-3.5 rounded-lg bg-surface hover:bg-stone-50/80 border border-stone-200 hover:border-stone-300 transition-all space-y-2.5 cursor-grab active:cursor-grabbing shadow-2xs"
                      >
                        {/* Drag Handle on hover */}
                        <div className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 text-stone-300 hover:text-stone-500 transition-opacity">
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        {/* Title */}
                        <div className="text-xs font-semibold text-stone-900 leading-snug pr-4">
                          {task.title}
                        </div>

                        {/* Owner & Deadlines */}
                        <div className="flex items-center justify-between gap-2 text-xs pt-1.5 border-t border-stone-100 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {task.owner ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-stone-100 border border-stone-300 text-[10px] font-semibold text-stone-700 flex items-center justify-center">
                                  {task.owner.slice(0, 1).toUpperCase()}
                                </span>
                                <span className="text-xs font-medium text-stone-800">
                                  @{task.owner}
                                </span>
                              </div>
                            ) : assigningTaskId === task.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  placeholder="Owner name..."
                                  value={assignOwnerInput}
                                  onChange={(e) => setAssignOwnerInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 text-xs bg-surface border border-stone-300 rounded focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleAssignOwner(task.id)}
                                  className="px-1.5 py-0.5 bg-stone-900 text-white rounded text-[11px]"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAssigningTaskId(task.id);
                                  setAssignOwnerInput('');
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-medium border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 flex items-center gap-1"
                              >
                                <UserPlus className="w-3 h-3 text-amber-700" />
                                <span>Assign</span>
                              </button>
                            )}
                          </div>

                          <div>{getDeadlineBadge(task.deadline, task.status)}</div>
                        </div>

                        {/* Dependency Line: Waiting for: <task> */}
                        {task.depends_on_title && (
                          <div className="text-[11px] px-2 py-1 rounded bg-stone-50 text-stone-700 border border-stone-200 flex items-center gap-1.5 truncate">
                            <GitBranch className="w-3 h-3 text-stone-500 shrink-0" />
                            <span className="truncate">Waiting for: {task.depends_on_title}</span>
                          </div>
                        )}

                        {/* Clarification Notice or Trello Link */}
                        <div className="flex items-center justify-between text-[11px] pt-1 text-stone-400">
                          {task.needs_clarification ? (
                            <span className="text-amber-800 flex items-center gap-1 text-[11px]">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Needs clarification
                            </span>
                          ) : (
                            <span className="text-stone-400 truncate max-w-[150px]">
                              {task.meeting_title || ''}
                            </span>
                          )}

                          {task.trello_url && (
                            <a
                              href={task.trello_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent-text hover:text-[#172aa3] flex items-center gap-0.5"
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
        /* TABLE VIEW (Dense with hairlines, sortable by deadline) */
        <div className="bg-surface border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-[#f7f6f2] border-b border-stone-200 text-xs font-semibold text-stone-700">
            <div className="col-span-5">Task Title</div>
            <div className="col-span-2">Owner</div>
            <div
              className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-stone-900 select-none"
              onClick={() => setDeadlineSortAsc(!deadlineSortAsc)}
              title="Click to sort by deadline"
            >
              <span>Deadline</span>
              <ArrowUpDown className="w-3 h-3 text-stone-400" />
            </div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Tracker</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-stone-100">
            {sortedTasks.map((task) => (
              <div
                key={task.id}
                className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center hover:bg-stone-50/70 transition-colors text-xs"
              >
                {/* Title & Dependency line */}
                <div className="col-span-5 space-y-1">
                  <span className="font-semibold text-stone-900 leading-snug">{task.title}</span>
                  {task.depends_on_title && (
                    <div className="text-[11px] text-stone-500 flex items-center gap-1">
                      <GitBranch className="w-3 h-3 text-stone-400" />
                      <span>Waiting for: {task.depends_on_title}</span>
                    </div>
                  )}
                  {task.needs_clarification && (
                    <p className="text-[11px] text-amber-800">Needs clarification on owner or date</p>
                  )}
                </div>

                {/* Owner */}
                <div className="col-span-2">
                  {task.owner ? (
                    <span className="font-medium text-stone-800">@{task.owner}</span>
                  ) : assigningTaskId === task.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Name..."
                        value={assignOwnerInput}
                        onChange={(e) => setAssignOwnerInput(e.target.value)}
                        className="w-20 px-1 py-0.5 text-xs bg-surface border border-stone-300 rounded"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAssignOwner(task.id)}
                        className="px-1.5 py-0.5 bg-stone-900 text-white rounded text-[11px]"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAssigningTaskId(task.id);
                        setAssignOwnerInput('');
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-medium border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    >
                      Assign
                    </button>
                  )}
                </div>

                {/* Deadline */}
                <div className="col-span-2">{getDeadlineBadge(task.deadline, task.status)}</div>

                {/* Status Dropdown */}
                <div className="col-span-2">
                  <select
                    value={task.status}
                    disabled={updatingTaskId === task.id}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    className="text-xs font-medium px-2 py-1 rounded border border-stone-200 bg-surface text-stone-800 focus:outline-none cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                {/* Tracker Link */}
                <div className="col-span-1 text-right">
                  {task.trello_url ? (
                    <a
                      href={task.trello_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-text hover:text-[#172aa3] text-xs inline-flex items-center gap-0.5"
                    >
                      <span>Trello</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-stone-300 text-[11px]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
