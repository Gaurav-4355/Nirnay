import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Compass,
  CheckSquare,
  AlertTriangle,
  Send,
  MessageSquare,
  Award,
  FileText,
  BookOpen,
  PlusCircle,
  LayoutDashboard,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from './theme';

export default function QuickSwitcher({
  isOpen,
  onClose,
  onNavigate,
  isSidebarCollapsed,
  onToggleSidebar,
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const { effectiveTheme, setTheme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const screens = [
    { id: 'dashboard', label: 'Today', icon: LayoutDashboard, group: 'Overview' },
    { id: 'new_meeting', label: 'New meeting', icon: PlusCircle, group: 'Capture' },
    { id: 'decisions', label: 'Decisions', icon: Compass, group: 'Memory' },
    { id: 'conflicts', label: 'Conflicts', icon: AlertTriangle, group: 'Memory' },
    { id: 'ask', label: 'Ask Nirnay', icon: MessageSquare, group: 'Memory' },
    { id: 'brief', label: 'Next meeting brief', icon: BookOpen, group: 'Memory' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, group: 'Work' },
    { id: 'outbox', label: 'Waiting for your approval', icon: Send, group: 'Work' },
    { id: 'digests', label: 'Weekly summaries', icon: FileText, group: 'Work' },
    { id: 'accuracy', label: 'How accurate is Nirnay?', icon: Award, group: 'Proof' },
  ];

  const actions = [
    {
      id: 'theme_toggle',
      label: effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      icon: effectiveTheme === 'dark' ? Sun : Moon,
      group: 'Settings',
      run: () => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'sidebar_toggle',
      label: isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
      icon: isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose,
      group: 'View',
      run: () => onToggleSidebar && onToggleSidebar(),
    },
  ];

  const filteredScreens = screens.filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase()) ||
    s.group.toLowerCase().includes(query.toLowerCase())
  );

  const filteredActions = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase()) ||
    a.group.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectScreen = (screenId) => {
    onNavigate(screenId);
    onClose();
  };

  const handleRunAction = (action) => {
    action.run();
    onClose();
  };

  const handleAsk = () => {
    onNavigate('ask', query);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (filteredActions.length > 0 && query.toLowerCase().includes('mode')) {
        handleRunAction(filteredActions[0]);
      } else if (filteredScreens.length > 0) {
        handleSelectScreen(filteredScreens[0].id);
      } else if (query.trim()) {
        handleAsk();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-raised border border-line rounded-[10px] shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-line">
          <Search className="w-4 h-4 text-ink-faint shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a screen, command, or question..."
            className="w-full bg-transparent text-[14px] text-ink placeholder-ink-faint focus:outline-none"
          />
          <kbd className="text-[11px] text-ink-faint bg-fill border border-line px-1.5 py-0.5 rounded-[4px] font-sans">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 divide-y divide-line">
          {/* Actions / Commands */}
          {filteredActions.length > 0 && (
            <div className="space-y-0.5 pb-1">
              {filteredActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleRunAction(item)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] text-left text-[13px] text-ink hover:bg-fill transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-accent-text" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <span className="text-[11px] text-ink-faint">{item.group}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Screens */}
          <div className="space-y-0.5 py-1">
            {filteredScreens.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectScreen(item.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] text-left text-[13px] text-ink hover:bg-fill transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-ink-soft" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className="text-[11px] text-ink-faint">{item.group}</span>
                </button>
              );
            })}
          </div>

          {/* Ask Nirnay Option */}
          {query.trim() && (
            <div className="pt-1">
              <button
                onClick={handleAsk}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-left text-[13px] text-accent-text hover:bg-accent-tint transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-accent-text" />
                <span>
                  Ask Nirnay: <span className="font-semibold italic">"{query}"</span>
                </span>
              </button>
            </div>
          )}

          {filteredScreens.length === 0 && filteredActions.length === 0 && !query.trim() && (
            <div className="p-4 text-center text-[13px] text-ink-faint">
              No screens or commands found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
