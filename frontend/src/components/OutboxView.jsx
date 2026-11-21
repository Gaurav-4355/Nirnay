import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Bell,
  Kanban,
  FileText,
  Edit2,
  Save,
  X,
  RefreshCw,
  CheckCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';

export default function OutboxView({ onStatsChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const [integrations, setIntegrations] = useState({ trello: false, webhook: false });

  const fetchItems = () => {
    setLoading(true);
    fetch('/api/outbox')
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
        if (onStatsChanged) onStatsChanged();
      })
      .catch((err) => {
        console.error('Error fetching outbox:', err);
        setLoading(false);
      });
  };

  const fetchIntegrations = () => {
    fetch('/api/integrations/status')
      .then((res) => res.json())
      .then((data) => setIntegrations(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchItems();
    fetchIntegrations();
  }, []);

  const pendingItems = items.filter((i) => i.status === 'pending');
  const historyItems = items.filter((i) => i.status !== 'pending');

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
      }
    } catch (err) {
      console.error('Error rejecting item:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      const res = await fetch('/api/outbox/approve-all', { method: 'POST' });
      if (res.ok) {
        fetchItems();
      }
    } catch (err) {
      console.error('Error approving all items:', err);
    } finally {
      setApprovingAll(false);
    }
  };

  const handleScanReminders = async () => {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch('/api/reminders/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setScanMessage(
          `Scan complete for ${data.today}: ${data.new_reminders_queued} new reminder(s) queued (${data.scanned_tasks_count} tasks evaluated).`
        );
        fetchItems();
      }
    } catch (err) {
      console.error('Error scanning reminders:', err);
    } finally {
      setScanning(false);
    }
  };

  const getKindBadge = (kind) => {
    switch (kind) {
      case 'tracker_create':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center gap-1">
            <Kanban className="w-3 h-3 text-indigo-400" />
            Create Card
          </span>
        );
      case 'tracker_update':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-950/80 text-blue-300 border border-blue-700/60 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 text-blue-400" />
            Update Card
          </span>
        );
      case 'reminder':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60 flex items-center gap-1">
            <Bell className="w-3 h-3 text-amber-400" />
            Reminder
          </span>
        );
      case 'digest':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-950/80 text-purple-300 border border-purple-700/60 flex items-center gap-1">
            <FileText className="w-3 h-3 text-purple-400" />
            Weekly Digest
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-slate-300">
            {kind}
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Send className="w-6 h-6 text-indigo-400" />
            Outbox & Execution Gateway
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Review and dispatch outward tracker cards, automated reminders, and team digests.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleScanReminders}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all shadow-sm"
            title="Scan tasks against simulated today date"
          >
            <Bell className={`w-3.5 h-3.5 text-amber-400 ${scanning ? 'animate-bounce' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Scan for Reminders'}</span>
          </button>

          {pendingItems.length > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{approvingAll ? 'Approving...' : `Approve All (${pendingItems.length})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Human Gate Banner */}
      <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-900/50 flex items-center justify-between gap-3 text-xs text-indigo-200">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong className="text-white">Human Confirmation Guard:</strong> Nothing is sent until you approve. You have complete control over external notifications and tracker tickets.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px]">
          <span
            className={`px-2 py-0.5 rounded-md border font-mono ${
              integrations.trello
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            Trello: {integrations.trello ? 'Connected' : 'Internal Mode'}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md border font-mono ${
              integrations.webhook
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            Webhook: {integrations.webhook ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Scan Message Alert */}
      {scanMessage && (
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/50 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{scanMessage}</span>
          </div>
          <button onClick={() => setScanMessage(null)} className="text-amber-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'pending'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>Pending Approval</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'pending'
                ? 'bg-indigo-700 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {pendingItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>Audit History</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'history'
                ? 'bg-indigo-700 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {historyItems.length}
          </span>
        </button>
      </div>

      {/* Main List Area */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-xs text-slate-400">Loading outbox queue...</p>
        </div>
      ) : activeTab === 'pending' ? (
        pendingItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80">
            <CheckCircle2 className="w-10 h-10 text-emerald-400/80 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-white">Outbox is completely clear</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              No pending notifications or tracker tickets. New meeting confirmations and reminder scans will populate items here for your approval.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingItems.map((item) => {
              const isEditing = editingId === item.id;
              const isActing = actionLoadingId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3.5 shadow-sm"
                >
                  {/* Top Bar of Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      {getKindBadge(item.kind)}
                      <span className="text-slate-500">•</span>
                      <span className="text-xs text-slate-400 font-medium">
                        Target: <strong className="text-slate-200 font-mono capitalize">{item.target}</strong>
                      </span>
                      {item.recipient && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="text-xs text-slate-400 font-medium">
                            To: <strong className="text-indigo-300">@{item.recipient}</strong>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(item)}
                            disabled={isActing}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                            title="Edit message title and body"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleApprove(item.id)}
                            disabled={isActing}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isActing ? 'Sending...' : 'Approve'}</span>
                          </button>
                          <button
                            onClick={() => handleReject(item.id)}
                            disabled={isActing}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/70 border border-rose-900/50 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title and Body */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-indigo-500 rounded-xl text-xs text-white focus:outline-none font-semibold"
                        placeholder="Item title"
                      />
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 bg-slate-950 border border-indigo-500 rounded-xl text-xs text-slate-200 focus:outline-none font-mono"
                        placeholder="Item body text"
                      />
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-sm font-semibold text-white tracking-tight">
                        {item.title}
                      </h4>
                      {item.body && (
                        <div className="mt-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {item.body}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Metadata Footer */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Queued: {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recent'}
                    </span>
                    {item.dedupe_key && (
                      <span className="font-mono text-[10px] text-slate-600 truncate max-w-sm" title={item.dedupe_key}>
                        dedupe: {item.dedupe_key}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* History / Audit Trail Tab */
        historyItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80">
            <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-white">No history yet</h4>
            <p className="text-xs text-slate-400 mt-1">
              Sent, failed, or rejected items will be preserved here as an immutable audit trail.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.status === 'sent' && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Sent
                      </span>
                    )}
                    {item.status === 'rejected' && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-slate-400" />
                        Rejected
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        Failed
                      </span>
                    )}
                    {getKindBadge(item.kind)}
                    <span className="text-xs text-slate-400 font-mono">[{item.target}]</span>
                    {item.recipient && (
                      <span className="text-xs text-indigo-300">@{item.recipient}</span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    {item.sent_at
                      ? `Sent: ${new Date(item.sent_at).toLocaleString()}`
                      : `Created: ${item.created_at ? new Date(item.created_at).toLocaleString() : ''}`}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200">{item.title}</div>

                {item.error && (
                  <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 font-mono">
                    Error: {item.error}
                  </div>
                )}

                {item.body && (
                  <div className="text-[11px] text-slate-400 font-mono bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {item.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
