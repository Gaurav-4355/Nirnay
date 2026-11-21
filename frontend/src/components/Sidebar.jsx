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
  CheckCircle2,
  PanelLeft,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { useTheme } from '../ui/theme';

export default function Sidebar({
  currentView,
  setCurrentView,
  stats,
  onResetData,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) {
  const [modelName, setModelName] = useState('Groq');
  const [resetting, setResetting] = useState(false);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState('ok');
  const systemRef = useRef(null);
  const { theme, setTheme } = useTheme();

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

  const handleItemClick = (id) => {
    setCurrentView(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        id="main-sidebar"
        className={`bg-surface border-r border-line flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none print:hidden z-40 transition-[width] duration-180 ease-out motion-reduce:transition-none ${
          isCollapsed ? 'w-[72px]' : 'w-[248px]'
        } max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[248px] ${
          isMobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
        } max-lg:transition-transform max-lg:duration-200`}
      >
        <div className="overflow-y-auto flex-1">
          {/* Brand Header */}
          <div className={`p-4 border-b border-line flex items-center ${isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[6px] bg-accent flex items-center justify-center text-white text-xs font-bold tracking-tight shrink-0 shadow-2xs">
                N
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-[17px] font-bold tracking-tight text-ink truncate">
                    Nirnay
                  </span>
                </div>
              )}
            </div>

            {/* Collapse toggle button on desktop */}
            <button
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
              aria-controls="main-sidebar"
              className="hidden lg:flex items-center justify-center p-1.5 rounded-[6px] text-ink-soft hover:text-ink hover:bg-fill transition-colors"
              title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-[6px] text-ink-soft hover:text-ink hover:bg-fill"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Sections */}
          <nav aria-label="Main" className="p-3 space-y-3">
            {navGroups.map((groupObj, gIdx) => (
              <div key={gIdx} className="space-y-0.5">
                {groupObj.group && (
                  isCollapsed ? (
                    <div className="border-t border-line my-2" />
                  ) : (
                    <div className="px-3 pb-1 text-[11px] font-medium text-ink-faint">
                      {groupObj.group}
                    </div>
                  )
                )}
                {groupObj.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => handleItemClick(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center rounded-[6px] text-[14px] transition-colors ${
                          isCollapsed
                            ? 'justify-center h-10 w-10 mx-auto'
                            : 'justify-between px-3 py-1.5'
                        } ${
                          isActive
                            ? 'bg-fill text-ink font-semibold border-l-2 border-accent rounded-l-none'
                            : 'text-ink-soft hover:text-ink hover:bg-fill'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-[18px] h-[18px] shrink-0 ${
                              isActive ? 'text-accent-text' : 'text-ink-soft'
                            }`}
                            strokeWidth={1.5}
                          />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </div>

                        {item.count !== undefined && item.count > 0 && (
                          isCollapsed ? (
                            <span
                              className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                                item.isBadgeAlert || item.isAlert ? 'bg-amber' : 'bg-accent'
                              }`}
                              title={`${item.count} items`}
                            />
                          ) : (
                            <span
                              className={`text-[12px] px-1.5 py-0.5 rounded-[4px] tabular-nums font-medium ${
                                item.isBadgeAlert || item.isAlert
                                  ? 'bg-amber-tint text-amber'
                                  : 'bg-fill text-ink-soft'
                              }`}
                            >
                              {item.count}
                            </span>
                          )
                        )}
                      </button>

                      {/* Tooltip on hover & focus in collapsed rail */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-[6px] bg-raised border border-line text-ink text-[12px] font-medium shadow-elevated whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50">
                          {item.label}
                          {item.count !== undefined && item.count > 0 && ` (${item.count})`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Footer System Popover Button */}
        <div className="p-3 border-t border-line relative" ref={systemRef}>
          <button
            onClick={() => setIsSystemOpen(!isSystemOpen)}
            className={`w-full flex items-center rounded-[6px] text-[13px] text-ink-soft hover:text-ink hover:bg-fill transition-colors ${
              isCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'justify-between px-3 py-2'
            }`}
            title="System settings & theme"
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  healthStatus === 'ok' ? 'bg-green' : 'bg-red'
                }`}
              />
              {!isCollapsed && <span className="truncate font-medium text-[12px]">System</span>}
            </div>
            {!isCollapsed && <Settings className="w-3.5 h-3.5 text-ink-faint" strokeWidth={1.5} />}
          </button>

          {/* System Popover with 3-Way Theme Segmented Control */}
          {isSystemOpen && (
            <div className={`absolute bottom-14 ${isCollapsed ? 'left-14 w-72' : 'left-3 right-3'} bg-raised border border-line rounded-[10px] shadow-elevated p-3.5 text-[13px] space-y-3.5 z-50`}>
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <span className="font-semibold text-ink text-[13px]">System details</span>
                <button
                  onClick={() => setIsSystemOpen(false)}
                  className="text-ink-faint hover:text-ink"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 3-Way Segmented Theme Control */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-ink-soft">Appearance theme</label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-fill rounded-[6px] border border-line">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-[4px] text-[12px] font-medium transition-colors ${
                      theme === 'light'
                        ? 'bg-surface text-ink shadow-2xs font-semibold'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    <Sun className="w-3 h-3" />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-[4px] text-[12px] font-medium transition-colors ${
                      theme === 'dark'
                        ? 'bg-surface text-ink shadow-2xs font-semibold'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    <Moon className="w-3 h-3" />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-[4px] text-[12px] font-medium transition-colors ${
                      theme === 'system'
                        ? 'bg-surface text-ink shadow-2xs font-semibold'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    <Laptop className="w-3 h-3" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              {/* System Info */}
              <div className="space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Health</span>
                  <span className="font-medium text-green flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Healthy
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">Active model</span>
                  <span className="font-mono text-[11px] text-ink truncate max-w-[120px]" title={modelName}>
                    {modelName}
                  </span>
                </div>
              </div>

              {/* Reset Database Button */}
              <div className="pt-1 border-t border-line">
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[6px] text-[12px] font-medium text-red hover:bg-red-tint border border-red/30 transition-colors"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                  <span>{resetting ? 'Resetting...' : 'Reset demo data'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
