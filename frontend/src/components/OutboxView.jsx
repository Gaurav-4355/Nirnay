import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bell,
  Kanban,
  FileText,
  Edit2,
  Save,
  X,
  RefreshCw,
  CheckCheck,
  Info,
  Clock,
} from 'lucide-react';
import StampBadge from '../ui/StampBadge';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import EmptyState from '../ui/EmptyState';
import ErrorAlert from '../ui/ErrorAlert';

export default function OutboxView({ onStatsChanged, showToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [integrations, setIntegrations] = useState({ trello: false, webhook: false });

  const fetchItems = () => {
    setLoading(true);
    setErrorMsg(null);
    fetch('/api/outbox')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load approval items');
        return res.json();
      })
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
        if (onStatsChanged) onStatsChanged();
      })
      .catch((err) => {
        console.error('Error fetching outbox:', err);
        setErrorMsg('Unable to retrieve approval gateway items.');
        setLoading(false);
      });
  };

  const fetchIntegrations = () => {
    fetch('/api/integrations/status')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setIntegrations(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchItems();
    fetchIntegrations();
  }, []);

  const pendingItems = items.filter((i) => i.status === 'pending');
  const historyItems = items.filter((i) => i.status !== 'pending');

  const trackerCards = pendingItems.filter(
    (i) => i.kind === 'tracker_create' || i.kind === 'tracker_update'
  );
  const reminders = pendingItems.filter((i) => i.kind === 'reminder');
  const weeklySummaries = pendingItems.filter((i) => i.kind === 'digest');

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditBody(item.body || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditBody('');
  };

  const handleSaveEdit = async (id) => {
    try {
      const res = await fetch(`/api/outbox/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
        setEditingId(null);
        if (showToast) showToast('Item updated successfully.', 'info');
      }
    } catch (err) {
      console.error('Error updating outbox item:', err);
    }
  };

  const handleApprove = async (id) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/outbox/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchItems();
        if (showToast) showToast('Item approved and dispatched.', 'success');
      }
    } catch (err) {
      console.error('Error approving item:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/outbox/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        fetchItems();
        if (showToast) showToast('Item rejected.', 'info');
      }
    } catch (err) {
      console.error('Error rejecting item:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveAll = async () => {
    if (pendingItems.length === 0) return;
    setApprovingAll(true);
    try {
      const res = await fetch('/api/outbox/approve-all', { method: 'POST' });
      if (res.ok) {
        fetchItems();
        if (showToast) showToast(`Approved all ${pendingItems.length} items.`, 'success');
      }
    } catch (err) {
      console.error('Error approving all items:', err);
    } finally {
      setApprovingAll(false);
    }
  };

  // Render individual message preview card
  const renderItemCard = (item) => {
    const isEditing = editingId === item.id;
    const isLoading = actionLoadingId === item.id;

    return (
      <div
        key={item.id}
        className="bg-surface border border-stone-200 rounded-xl p-4 shadow-2xs space-y-3 transition-all"
      >
        {/* Header & Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                {item.target === 'trello' ? 'Trello card' : 'Webhook payload'}
              </span>
              {item.recipient && (
                <span className="text-xs text-stone-500 font-medium">To: @{item.recipient}</span>
              )}
            </div>
            {!isEditing && (
              <h4 className="text-xs font-bold text-stone-900 mt-1">{item.title}</h4>
            )}
          </div>

          {/* Action buttons (Edit, Approve, Reject) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isEditing && (
              <>
                <button
                  onClick={() => handleStartEdit(item)}
                  disabled={isLoading}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                  title="Edit message content"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleReject(item.id)}
                  disabled={isLoading}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-stone-200 bg-surface hover:bg-red-50 text-stone-600 hover:text-red-700 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(item.id)}
                  disabled={isLoading}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-stone-900 hover:bg-stone-800 text-white shadow-2xs transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{isLoading ? 'Sending...' : 'Approve'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Editing mode or Message preview */}
        {isEditing ? (
          <div className="space-y-2 pt-1 border-t border-stone-100">
            <div>
              <label className="text-[10px] text-stone-500 font-medium">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-stone-500 font-medium">Message Body</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={4}
                className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 text-xs text-stone-900 font-sans focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={handleCancelEdit}
                className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(item.id)}
                className="px-3 py-1 bg-stone-900 text-white text-xs font-medium rounded-lg flex items-center gap-1"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#f7f6f2] p-3 rounded-lg border border-stone-200 text-xs text-stone-700 whitespace-pre-wrap font-sans leading-relaxed">
            {item.body || 'No description body.'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-stone-700" />
            Waiting for Your Approval
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Nothing leaves the system without human verification. Review card creations, reminders, and weekly digests before sending.
          </p>
        </div>

        {/* Tab Toggle & Approve All button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'pending'
                  ? 'bg-surface text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Pending ({pendingItems.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-surface text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              History ({historyItems.length})
            </button>
          </div>

          {activeTab === 'pending' && pendingItems.length > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white shadow-2xs transition-all"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{approvingAll ? 'Approving...' : `Approve all (${pendingItems.length})`}</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && <ErrorAlert message={errorMsg} onRetry={fetchItems} />}

      {/* Calm notice when Trello is not configured */}
      {!integrations.trello && (
        <div className="p-3 bg-stone-100/80 border border-stone-200 rounded-lg text-xs text-stone-600 flex items-center gap-2">
          <Info className="w-4 h-4 text-stone-400 shrink-0" />
          <span>
            <strong>Internal tracker mode:</strong> Trello integration is not configured. Cards remain safely recorded and accessible inside Nirnay.
          </span>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : activeTab === 'pending' ? (
        pendingItems.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Outbox is clear"
            description="All notifications, tracker dispatches, and digests have been approved."
          />
        ) : (
          <div className="space-y-8">
            {/* Group 1: Tracker Cards */}
            {trackerCards.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-stone-200">
                  <Kanban className="w-4 h-4 text-stone-600" />
                  <h3 className="text-xs font-semibold text-stone-900">
                    Tracker cards ({trackerCards.length})
                  </h3>
                </div>
                <div className="space-y-3">{trackerCards.map(renderItemCard)}</div>
              </div>
            )}

            {/* Group 2: Reminders */}
            {reminders.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-stone-200">
                  <Bell className="w-4 h-4 text-stone-600" />
                  <h3 className="text-xs font-semibold text-stone-900">
                    Reminders ({reminders.length})
                  </h3>
                </div>
                <div className="space-y-3">{reminders.map(renderItemCard)}</div>
              </div>
            )}

            {/* Group 3: Weekly Summaries */}
            {weeklySummaries.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-stone-200">
                  <FileText className="w-4 h-4 text-stone-600" />
                  <h3 className="text-xs font-semibold text-stone-900">
                    Weekly summaries ({weeklySummaries.length})
                  </h3>
                </div>
                <div className="space-y-3">{weeklySummaries.map(renderItemCard)}</div>
              </div>
            )}
          </div>
        )
      ) : (
        /* History Tab: Plain Timeline */
        historyItems.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No dispatch history yet"
            description="Items that you approve or reject will appear in this audit log."
          />
        ) : (
          <div className="bg-surface border border-stone-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-stone-100">
            {historyItems.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4 text-xs hover:bg-stone-50/70 transition-colors">
                <div className="space-y-0.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900">{item.title}</span>
                    <StampBadge status={item.status} />
                  </div>
                  <p className="text-stone-500 text-[11px] line-clamp-1">{item.body || 'No description.'}</p>
                </div>
                <div className="text-stone-400 text-right shrink-0">
                  <div className="text-[11px] text-stone-600">
                    {item.sent_at ? new Date(item.sent_at).toLocaleDateString() : new Date(item.created_at).toLocaleDateString()}
                  </div>
                  <span className="text-[10px] text-stone-400 capitalize">{item.target}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
