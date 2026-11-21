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
import { Send, Zap, Search } from 'lucide-react';

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
  const [toasts, setToasts] = useState([]);

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

  // Global Ctrl/Cmd + K shortcut listener for quick switcher
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsQuickSwitcherOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMeetingSaved = (savedMeeting) => {
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
    <div className="flex min-h-screen bg-white text-[#0f1222] font-sans selection:bg-[#eef1fd] selection:text-[#1e35c7]">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        stats={stats}
        onResetData={handleResetData}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto min-h-screen bg-white relative flex flex-col">
        {/* Top bar 56px, white, 1px bottom hairline */}
        <header className="h-14 border-b border-[#e7e9ee] px-8 flex items-center justify-between bg-white sticky top-0 z-30 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[17px] font-semibold text-[#0f1222]">
              {getPageTitle(currentView)}
            </span>
            <button
              onClick={() => setIsQuickSwitcherOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-[6px] text-[12px] text-[#8a90a2] bg-[#f7f8fa] hover:bg-[#e7e9ee]/60 border border-[#e7e9ee] transition-colors"
              title="Quick switcher (Ctrl/Cmd + K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
              <kbd className="text-[10px] bg-white border border-[#e7e9ee] px-1 py-0.2 rounded text-[#5e6477]">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Waiting for approval quick link button */}
            {stats.pendingOutboxCount > 0 && (
              <button
                onClick={() => setCurrentView('outbox')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium bg-[#fff6e5] hover:bg-[#ffeec2] text-[#b26b00] border border-[#b26b00]/30 transition-colors tabular-nums"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Waiting for approval ({stats.pendingOutboxCount})</span>
              </button>
            )}

            {/* Guided Demo Button in Top Bar */}
            <button
              onClick={() => setIsDemoOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium bg-white hover:bg-[#f7f8fa] text-[#0f1222] border border-[#e7e9ee] transition-colors shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-[#b26b00]" strokeWidth={1.5} />
              <span>Guided demo</span>
            </button>

            {/* Simulated date chip */}
            <TodayChip onDateChanged={refreshStats} />
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
        />

        {/* Global Toast Notifications */}
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    </div>
  );
}
