import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import NewMeetingView from './components/NewMeetingView';
import DecisionsView from './components/DecisionsView';
import TasksView from './components/TasksView';
import ConflictsView from './components/ConflictsView';
import OutboxView from './components/OutboxView';
import DigestsView from './components/DigestsView';
import MeetingBriefView from './components/MeetingBriefView';
import TodayChip from './components/TodayChip';

export default function App() {
  const [currentView, setCurrentView] = useState('new_meeting');
  const [stats, setStats] = useState({
    decisionsCount: 0,
    tasksCount: 0,
    conflictsCount: 0,
    pendingOutboxCount: 0,
  });

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
  };

  const handleResetData = () => {
    refreshStats();
    setCurrentView('new_meeting');
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        stats={stats}
        onResetData={handleResetData}
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto min-h-screen bg-[#0b0f17]">
        {/* Top bar with simulated today indicator */}
        <header className="h-14 border-b border-slate-800/80 px-8 flex items-center justify-between bg-slate-950/40 backdrop-blur-sm sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-300 capitalize">
              {currentView.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <TodayChip onDateChanged={refreshStats} />
          </div>
        </header>

        {/* Content Views */}
        <div>
          {currentView === 'new_meeting' && (
            <NewMeetingView onMeetingSaved={handleMeetingSaved} />
          )}
          {currentView === 'decisions' && <DecisionsView />}
          {currentView === 'tasks' && <TasksView />}
          {currentView === 'conflicts' && <ConflictsView />}
          {currentView === 'outbox' && (
            <OutboxView onStatsChanged={refreshStats} />
          )}
          {currentView === 'digests' && (
            <DigestsView onNavigateToOutbox={() => setCurrentView('outbox')} />
          )}
          {currentView === 'brief' && <MeetingBriefView />}
        </div>
      </main>
    </div>
  );
}
