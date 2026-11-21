import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Compass,
  CheckSquare,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Send,
  FileText,
  BookOpen,
  MessageSquare,
  Award,
  HelpCircle,
} from 'lucide-react';

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
      label: 'New Meeting',
      icon: PlusCircle,
      description: 'Analyze & extract actions',
    },
    {
      id: 'decisions',
      label: 'Decisions',
      icon: Compass,
      count: stats?.decisionsCount,
      description: 'Historical decision timeline',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      count: stats?.tasksCount,
      description: 'Execution tracking board',
    },
    {
      id: 'conflicts',
      label: 'Conflicts',
      icon: AlertTriangle,
      count: stats?.conflictsCount,
      description: 'Cross-meeting conflicts log',
    },
    {
      id: 'outbox',
      label: 'Outbox',
      icon: Send,
      count: stats?.pendingOutboxCount,
      isAlert: stats?.pendingOutboxCount > 0,
      description: 'Approval & notification gateway',
    },
    {
      id: 'ask',
      label: 'Ask Nirnay',
      icon: MessageSquare,
      description: 'Grounded AI with citations',
    },
    {
      id: 'accuracy',
      label: 'Accuracy',
      icon: Award,
      description: 'Benchmark scoreboard',
    },
    {
      id: 'digests',
      label: 'Weekly Digests',
      icon: FileText,
      description: 'Team commitment summaries',
    },
    {
      id: 'brief',
      label: 'Meeting Brief',
      icon: BookOpen,
      description: 'Pre-meeting printable pack',
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none print:hidden">
      <div className="overflow-y-auto">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-lg shadow-indigo-900/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                Nirnay
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  AI
                </span>
              </h1>
              <p className="text-[11px] font-medium text-slate-400">Meeting-to-Execution</p>
            </div>
          </div>
          <p className="mt-3 text-xs italic text-amber-300/80 bg-amber-950/30 border border-amber-900/40 rounded-lg px-2.5 py-1.5">
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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-white'
                        : item.id === 'conflicts'
                        ? 'text-rose-400'
                        : item.id === 'accuracy'
                        ? 'text-amber-400'
                        : item.id === 'outbox' && item.isAlert
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      isActive
                        ? 'bg-indigo-700 text-indigo-100'
                        : item.id === 'conflicts'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : item.id === 'outbox'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
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

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 space-y-2.5 shrink-0">
        {/* Dynamic Model Indicator */}
        <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 truncate max-w-[170px]" title={modelName}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
            <span className="truncate">{modelName}</span>
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[10px]">
            active
          </span>
        </div>

        {/* How It Works Modal Button */}
        {onOpenHowItWorks && (
          <button
            onClick={onOpenHowItWorks}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>How Nirnay Works</span>
          </button>
        )}

        {/* Reset Demo Data Button */}
        <button
          onClick={handleReset}
          disabled={resetting}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-rose-400/90 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/50 border border-rose-900/40 transition-colors"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          <span>{resetting ? 'Resetting...' : 'Reset Demo Data'}</span>
        </button>
      </div>
    </aside>
  );
}
