import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import NewMeetingView from './components/NewMeetingView';
import DecisionsView from './components/DecisionsView';
import TasksView from './components/TasksView';
import ConflictsView from './components/ConflictsView';
import OutboxView from './components/OutboxView';
import AskNirnayView from './components/AskNirnayView';
import AccuracyView from './components/AccuracyView';
import DigestsView from './components/DigestsView';
import MeetingBriefView from './components/MeetingBriefView';
import TodayChip from './components/TodayChip';
import GuidedDemoDrawer from './components/GuidedDemoDrawer';
import HowItWorksModal from './components/HowItWorksModal';
import ToastContainer from './components/ToastContainer';
import QuickSwitcher from './ui/QuickSwitcher';
import { useTheme } from './ui/theme';
import { Send, Zap, Search, Sun, Moon, Menu } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [stats, setStats] = useState({
    decisionsCount: 0,
    tasksCount: 0,
    conflictsCount: 0,
    pendingOutboxCount: 0,
  });
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const { effectiveTheme, setTheme } = useTheme();

  // Collapsible sidebar state stored in localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nirnay.sidebar') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nirnay.sidebar', String(next));
      } catch (e) {
        console.warn('LocalStorage error saving sidebar state', e);
      }
      return next;
    });
  };

  const toggleThemeMode = () => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const refreshStats = () => {
    Promise.all([
      fetch('/api/decisions').then((res) => res.json()).catch(() => []),
      fetch('/api/tasks').then((res) => res.json()).catch(() => []),
      fetch('/api/conflicts').then((res) => res.json()).catch(() => []),
      fetch('/api/outbox').then((res) => res.json()).catch(() => []),
    ]).then(([decs, tsks, confs, outbox]) => {
      const pendingOutbox = Array.isArray(outbox)
        ? outbox.filter((i) => i.status === 'pending').length
        : 0;

      setStats({
        decisionsCount: Array.isArray(decs) ? decs.length : 0,
        tasksCount: Array.isArray(tsks) ? tsks.length : 0,
        conflictsCount: Array.isArray(confs) ? confs.length : 0,
        pendingOutboxCount: pendingOutbox,
      });
    });
  };

  useEffect(() => {
    refreshStats();
  }, [currentView]);

  // Global Keyboard shortcuts: Ctrl/Cmd + K (quick switcher) and Ctrl/Cmd + B (sidebar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsQuickSwitcherOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === 'Escape' && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);

  const handleMeetingSaved = () => {
    refreshStats();
    addToast('Meeting saved to memory. Tracker cards queued for approval.', 'success');
  };

  const handleResetData = () => {
    refreshStats();
    setCurrentView('dashboard');
    addToast('Database reset to clean state.', 'info');
  };

  const getPageTitle = (view) => {
    switch (view) {
      case 'dashboard':
        return 'Today';
      case 'new_meeting':
        return 'New meeting';
      case 'decisions':
        return 'Decisions';
      case 'tasks':
        return 'Tasks';
      case 'conflicts':
        return 'Conflicts';
      case 'outbox':
        return 'Waiting for your approval';
      case 'ask':
        return 'Ask Nirnay';
      case 'accuracy':
        return 'How accurate is Nirnay?';
      case 'digests':
        return 'Weekly summaries';
      case 'brief':
        return 'Next meeting brief';
      default:
        return 'Nirnay';
    }
  };

  return (
    <div className="flex min-h-screen bg-bg text-ink font-sans selection:bg-accent-tint selection:text-accent-text">
      {/* Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        stats={stats}
        onResetData={handleResetData}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto min-h-screen bg-bg relative flex flex-col">
        {/* Top bar 56px */}
        <header className="h-14 border-b border-line px-4 sm:px-8 flex items-center justify-between bg-surface sticky top-0 z-30 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="lg:hidden p-1.5 rounded-[6px] text-ink-soft hover:text-ink hover:bg-fill transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="text-[17px] font-semibold text-ink">
              {getPageTitle(currentView)}
            </span>

            {/* Quick Switcher Search Pill */}
            <button
              onClick={() => setIsQuickSwitcherOpen(true)}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-[6px] text-[12px] text-ink-faint bg-fill hover:bg-line border border-line transition-colors"
              title="Quick switcher (Ctrl/Cmd + K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
              <kbd className="text-[10px] bg-surface border border-line px-1 py-0.2 rounded text-ink-soft">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Waiting for approval quick link button */}
            {stats.pendingOutboxCount > 0 && (
              <button
                onClick={() => setCurrentView('outbox')}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium bg-amber-tint hover:bg-amber-tint/80 text-amber border border-amber/30 transition-colors tabular-nums"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Waiting for approval ({stats.pendingOutboxCount})</span>
              </button>
            )}

            {/* Guided Demo Button in Top Bar */}
            <button
              onClick={() => setIsDemoOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium bg-surface hover:bg-fill text-ink border border-line transition-colors shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-amber" strokeWidth={1.5} />
              <span>Guided demo</span>
            </button>

            {/* Simulated date chip */}
            <TodayChip onDateChanged={refreshStats} />

            {/* Compact Light / Dark Mode Toggle Button */}
            <button
              onClick={toggleThemeMode}
              aria-label={effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded-[6px] text-ink-soft hover:text-ink hover:bg-fill border border-line transition-colors"
            >
              {effectiveTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber" />
              ) : (
                <Moon className="w-4 h-4 text-ink-soft" />
              )}
            </button>
          </div>
        </header>

        {/* Content Views */}
        <div className="flex-1">
          {currentView === 'dashboard' && (
            <DashboardView
              onStartDemo={() => setIsDemoOpen(true)}
              onNavigate={setCurrentView}
            />
          )}
          {currentView === 'new_meeting' && (
            <NewMeetingView onMeetingSaved={handleMeetingSaved} showToast={addToast} />
          )}
          {currentView === 'decisions' && <DecisionsView />}
          {currentView === 'tasks' && <TasksView showToast={addToast} />}
          {currentView === 'conflicts' && <ConflictsView />}
          {currentView === 'outbox' && (
            <OutboxView onStatsChanged={refreshStats} showToast={addToast} />
          )}
          {currentView === 'ask' && <AskNirnayView showToast={addToast} />}
          {currentView === 'accuracy' && <AccuracyView showToast={addToast} />}
          {currentView === 'digests' && (
            <DigestsView onNavigateToOutbox={() => setCurrentView('outbox')} />
          )}
          {currentView === 'brief' && <MeetingBriefView />}
        </div>

        {/* Guided Demo Side Panel Drawer */}
        <GuidedDemoDrawer
          isOpen={isDemoOpen}
          onClose={() => setIsDemoOpen(false)}
          onNavigate={setCurrentView}
          showToast={addToast}
          onRefreshAll={refreshStats}
        />

        {/* How Nirnay Works Architecture Modal */}
        <HowItWorksModal
          isOpen={isHowItWorksOpen}
          onClose={() => setIsHowItWorksOpen(false)}
        />

        {/* Quick Switcher Modal (Ctrl/Cmd + K) */}
        <QuickSwitcher
          isOpen={isQuickSwitcherOpen}
          onClose={() => setIsQuickSwitcherOpen(false)}
          onNavigate={setCurrentView}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        {/* Global Toast Notifications */}
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    </div>
  );
}
