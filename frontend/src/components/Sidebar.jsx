import React, { useState, useEffect, useRef } from 'react';
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
  Settings,
  X,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export default function Sidebar({
  currentView,
  setCurrentView,
  stats,
  onResetData,
}) {
  const [modelName, setModelName] = useState('Groq');
  const [resetting, setResetting] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState('ok');
  const systemRef = useRef(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.model) setModelName(data.model);
        if (data.status) setHealthStatus(data.status);
      })
      .catch(() => setHealthStatus('unreachable'));
  }, []);

  // Close system popover on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (systemRef.current && !systemRef.current.contains(event.target)) {
        setIsSystemOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReset = async () => {
    if (
      window.confirm(
        'Reset all meetings, decisions, tasks, and conflicts? This will clear the database.'
      )
    ) {
      setResetting(true);
      try {
        await fetch('/api/reset', { method: 'POST' });
        if (onResetData) onResetData();
        setIsSystemOpen(false);
      } catch (err) {
        console.error('Error resetting database:', err);
      } finally {
        setResetting(false);
      }
    }
  };

  const navGroups = [
    {
      group: null,
      items: [
        {
          id: 'dashboard',
          label: 'Today',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      group: 'Capture',
      items: [
        {
          id: 'new_meeting',
          label: 'New meeting',
          icon: PlusCircle,
        },
      ],
    },
    {
      group: 'Memory',
      items: [
        {
          id: 'decisions',
          label: 'Decisions',
          icon: Compass,
          count: stats?.decisionsCount,
        },
        {
          id: 'conflicts',
          label: 'Conflicts',
          icon: AlertTriangle,
          count: stats?.conflictsCount,
          isAlert: stats?.conflictsCount > 0,
        },
        {
          id: 'ask',
          label: 'Ask Nirnay',
          icon: MessageSquare,
        },
        {
          id: 'brief',
          label: 'Next meeting brief',
          icon: BookOpen,
        },
      ],
    },
    {
      group: 'Work',
      items: [
        {
          id: 'tasks',
          label: 'Tasks',
          icon: CheckSquare,
          count: stats?.tasksCount,
        },
        {
          id: 'outbox',
          label: 'Waiting for your approval',
          icon: Send,
          count: stats?.pendingOutboxCount,
          isBadgeAlert: stats?.pendingOutboxCount > 0,
        },
        {
          id: 'digests',
          label: 'Weekly summaries',
          icon: FileText,
        },
      ],
    },
    {
      group: 'Proof',
      items: [
        {
          id: 'accuracy',
          label: 'How accurate is Nirnay?',
          icon: Award,
        },
      ],
    },
  ];

  return (
    <aside className="w-[248px] bg-white border-r border-[#e7e9ee] flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none print:hidden z-20">
      <div className="overflow-y-auto flex-1">
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-[#e7e9ee] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[6px] bg-[#1e35c7] flex items-center justify-center text-white text-xs font-bold tracking-tight">
              N
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[17px] font-bold tracking-tight text-[#0f1222]">
                  Nirnay
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="p-3 space-y-4">
          {navGroups.map((groupObj, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              {groupObj.group && (
                <div className="px-3 pb-1 text-[12px] font-medium text-[#8a90a2]">
                  {groupObj.group}
                </div>
              )}
              {groupObj.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[6px] text-[14px] transition-colors ${
                      isActive
                        ? 'bg-[#f7f8fa] text-[#0f1222] font-semibold border-l-2 border-[#1e35c7] rounded-l-none'
                        : 'text-[#5e6477] hover:text-[#0f1222] hover:bg-[#f7f8fa]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#1e35c7]' : 'text-[#5e6477]'
                        }`}
                        strokeWidth={1.5}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`text-[12px] px-1.5 py-0.5 rounded-[4px] tabular-nums font-medium ${
                          item.isBadgeAlert || item.isAlert
                            ? 'bg-[#fff6e5] text-[#b26b00]'
                            : 'bg-[#f7f8fa] text-[#5e6477]'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer System Popover Button */}
      <div className="p-3 border-t border-[#e7e9ee] relative" ref={systemRef}>
        <button
          onClick={() => setIsSystemOpen(!isSystemOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] text-[13px] text-[#5e6477] hover:text-[#0f1222] hover:bg-[#f7f8fa] transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                healthStatus === 'ok' ? 'bg-[#14795a]' : 'bg-[#d0272d]'
              }`}
            />
            <span className="truncate font-medium text-[12px]">System</span>
          </div>
          <Settings className="w-3.5 h-3.5 text-[#8a90a2]" strokeWidth={1.5} />
        </button>

        {/* System Popover */}
        {isSystemOpen && (
          <div className="absolute bottom-14 left-3 right-3 bg-white border border-[#e7e9ee] rounded-[10px] shadow-elevated p-3 text-[13px] space-y-3 z-50">
            <div className="flex items-center justify-between pb-2 border-b border-[#e7e9ee]">
              <span className="font-semibold text-[#0f1222] text-[13px]">System details</span>
              <button
                onClick={() => setIsSystemOpen(false)}
                className="text-[#8a90a2] hover:text-[#0f1222]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#5e6477]">Health</span>
                <span className="font-medium text-[#14795a] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Healthy
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e6477]">Active model</span>
                <span className="font-mono text-[11px] text-[#0f1222] truncate max-w-[120px]" title={modelName}>
                  {modelName}
                </span>
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[6px] text-[12px] font-medium text-[#d0272d] hover:bg-[#fdf1f1] border border-[#d0272d]/30 transition-colors"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span>{resetting ? 'Resetting...' : 'Reset demo data'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
