import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import NewMeetingView from './components/NewMeetingView';
import DecisionsView from './components/DecisionsView';
import TasksView from './components/TasksView';
import ConflictsView from './components/ConflictsView';

export default function App() {
  const [currentView, setCurrentView] = useState('new_meeting');
  const [stats, setStats] = useState({
    decisionsCount: 0,
    tasksCount: 0,
    conflictsCount: 0,
  });

  const refreshStats = () => {
    Promise.all([
      fetch('/api/decisions').then((res) => res.json()).catch(() => []),
      fetch('/api/tasks').then((res) => res.json()).catch(() => []),
      fetch('/api/conflicts').then((res) => res.json()).catch(() => []),
    ]).then(([decs, tsks, confs]) => {
      setStats({
        decisionsCount: Array.isArray(decs) ? decs.length : 0,
        tasksCount: Array.isArray(tsks) ? tsks.length : 0,
        conflictsCount: Array.isArray(confs) ? confs.length : 0,
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
        {currentView === 'new_meeting' && (
          <NewMeetingView onMeetingSaved={handleMeetingSaved} />
        )}
        {currentView === 'decisions' && <DecisionsView />}
        {currentView === 'tasks' && <TasksView />}
        {currentView === 'conflicts' && <ConflictsView />}
      </main>
    </div>
  );
}
