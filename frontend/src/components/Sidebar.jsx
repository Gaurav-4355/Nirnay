import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Compass,
  CheckSquare,
  AlertTriangle,
  RotateCcw,
  Send,
  FileText,
  BookOpen,
  MessageSquare,
  Award,
  HelpCircle,
} from 'lucide-react';
import StampBadge from '../ui/StampBadge';

export default function Sidebar({
  currentView,
  setCurrentView,
  stats,
  onResetData,
  onOpenHowItWorks,
}) {
  const [modelName, setModelName] = useState('Groq');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.model) {
          setModelName(data.model);
        }
      })
      .catch(() => {});
  }, []);

  const handleReset = async () => {
    if (
      window.confirm(
        'Are you sure you want to reset all meetings, decisions, tasks, and conflicts? This will clear the database.'
      )
    ) {
      setResetting(true);
      try {
        await fetch('/api/reset', { method: 'POST' });
        if (onResetData) {
          onResetData();
        }
      } catch (err) {
        console.error('Error resetting database:', err);
      } finally {
        setResetting(false);
      }
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Operations overview',
    },
    {
      id: 'new_meeting',
      label: 'New meeting',
      icon: PlusCircle,
      description: 'Analyze transcript',
    },
    {
      id: 'decisions',
      label: 'Decisions',
      icon: Compass,
      count: stats?.decisionsCount,
      description: 'Living ledger',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      count: stats?.tasksCount,
      description: 'Board and table',
    },
    {
      id: 'conflicts',
      label: 'Conflicts',
      icon: AlertTriangle,
      count: stats?.conflictsCount,
      description: 'Detected clashes',
    },
    {
      id: 'outbox',
      label: 'Waiting for approval',
      icon: Send,
      count: stats?.pendingOutboxCount,
      isAlert: stats?.pendingOutboxCount > 0,
      description: 'Tracker & reminder outbox',
    },
    {
      id: 'ask',
      label: 'Ask Nirnay',
      icon: MessageSquare,
      description: 'Grounded conversation',
    },
    {
      id: 'accuracy',
      label: 'Accuracy',
      icon: Award,
      description: 'Benchmark scoreboard',
    },
    {
      id: 'digests',
      label: 'Weekly summaries',
      icon: FileText,
      description: 'Team commitments',
    },
    {
      id: 'brief',
      label: 'Meeting brief',
      icon: BookOpen,
      description: 'Printable agenda pack',
    },
  ];

  return (
    <aside className="w-64 bg-[#f7f6f2] border-r border-stone-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none print:hidden">
      <div className="overflow-y-auto">
        {/* Brand Header */}
        <div className="p-5 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white text-sm font-bold shadow-xs">
              N
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-bold tracking-tight text-stone-900">
                  Nirnay
                </h1>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-stone-300 text-stone-600 bg-white">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium">Meeting-to-Execution</p>
            </div>
          </div>
          <p className="mt-3 text-xs italic text-stone-700 bg-stone-200/50 border border-stone-300/60 rounded-lg px-2.5 py-1.5 font-serif">
            "Meeting ke faisle, kaam mein badlo."
          </p>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-stone-900 text-white font-semibold shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-stone-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded font-sans ${
                      isActive
                        ? 'bg-stone-800 text-stone-200'
                        : item.isAlert
                        ? 'bg-amber-100 text-amber-900 font-semibold border border-amber-300'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Actions */}
      <div className="p-4 border-t border-stone-200 space-y-3 bg-[#f7f6f2]">
        <div className="flex items-center justify-between text-stone-600 text-xs">
          <span className="flex items-center gap-1.5 truncate max-w-[170px]" title={modelName}>
            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="truncate">{modelName}</span>
          </span>
          <span className="text-[10px] text-stone-500">active</span>
        </div>

        <button
          onClick={onOpenHowItWorks}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200 transition-colors shadow-2xs"
        >
          <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
          <span>How Nirnay works</span>
        </button>

        <button
          onClick={handleReset}
          disabled={resetting}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-stone-500 hover:text-red-700 bg-transparent hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          <span>{resetting ? 'Resetting...' : 'Reset demo data'}</span>
        </button>
      </div>
    </aside>
  );
}
