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
import { Zap } from 'lucide-react';

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

  const handleMeetingSaved = (savedMeeting) => {
    refreshStats();
    addToast('Meeting saved successfully! Tracker cards queued in Outbox.', 'success');
  };

  const handleResetData = () => {
    refreshStats();
    setCurrentView('dashboard');
    addToast('Database reset to clean state.', 'info');
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        stats={stats}
        onResetData={handleResetData}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto min-h-screen bg-[#0b0f17] relative">
        {/* Top bar with simulated today indicator */}
        <header className="h-14 border-b border-slate-800/80 px-8 flex items-center justify-between bg-slate-950/40 backdrop-blur-sm sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-300 capitalize">
              {currentView.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDemoOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 shadow-sm transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Guided Demo</span>
            </button>
            <TodayChip onDateChanged={refreshStats} />
          </div>
        </header>

        {/* Content Views */}
        <div>
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

        {/* Floating Guided Demo Button on Bottom Right */}
        <div className="fixed bottom-6 right-6 z-40 print:hidden">
          <button
            onClick={() => setIsDemoOpen(!isDemoOpen)}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-2xl shadow-indigo-900/50 hover:scale-105 active:scale-95 transition-all"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-current" />
            <span>Guided Demo</span>
          </button>
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

        {/* Global Toast Notifications */}
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </main>
    </div>
  );
}
