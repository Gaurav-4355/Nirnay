import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Quote,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  FileText,
  UserCheck,
  Shuffle,
  Users,
  GitBranch,
  ShieldAlert,
  Check,
} from 'lucide-react';
import TranscriptHighlighter from './TranscriptHighlighter';

export default function NewMeetingView({ onMeetingSaved }) {
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [transcript, setTranscript] = useState('');
  const [demoMeetings, setDemoMeetings] = useState([]);
  const [selectedDemoId, setSelectedDemoId] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Proposal state
  const [proposal, setProposal] = useState(null);
  const [activeQuote, setActiveQuote] = useState(null);

  // Conflict resolutions state: mapped by conflict index: "kept_new" | "kept_old" | "acknowledged"
  const [conflictChoices, setConflictChoices] = useState({});

  // Task updates toggles: mapped by task_id -> boolean
  const [taskUpdatesIncluded, setTaskUpdatesIncluded] = useState({});

  useEffect(() => {
    fetch('/api/seed/demo-meetings')
      .then((res) => res.json())
      .then((data) => setDemoMeetings(data))
      .catch((err) => console.error('Error fetching demo meetings:', err));
  }, []);

  const handleSelectDemo = (e) => {
    const demoId = e.target.value;
    setSelectedDemoId(demoId);
    if (!demoId) return;

    const selected = demoMeetings.find((d) => d.id === parseInt(demoId, 10));
    if (selected) {
      setTitle(selected.title);
      setMeetingDate(selected.meeting_date);
      setTranscript(selected.transcript);
      setProposal(null);
      setError(null);
      setActiveQuote(null);
      setConflictChoices({});
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setTranscript(event.target.result);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError('Please provide a meeting transcript.');
      return;
    }
    setError(null);
    setLoading(true);
    setProposal(null);
    setActiveQuote(null);
    setConflictChoices({});

    try {
      const res = await fetch('/api/meetings/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Untitled Meeting',
          meeting_date: meetingDate,
          transcript: transcript.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to analyze transcript');
      }

      const data = await res.json();
      setProposal(data);

      // Initialize task updates inclusion map (all default to true)
      const incMap = {};
      (data.task_updates || []).forEach((tu) => {
        incMap[tu.task_id] = true;
      });
      setTaskUpdatesIncluded(incMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateDecisionField = (index, field, value) => {
    if (!proposal) return;
    const updated = [...proposal.decisions];
    updated[index] = { ...updated[index], [field]: value };
    setProposal({ ...proposal, decisions: updated });
  };

  const updateTaskField = (index, field, value) => {
    if (!proposal) return;
    const updated = [...proposal.tasks];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'owner' || field === 'deadline') {
      const ownerVal = field === 'owner' ? value : updated[index].owner;
      const dlVal = field === 'deadline' ? value : updated[index].deadline;
      if (ownerVal && ownerVal.trim() && dlVal && dlVal.trim()) {
        updated[index].needs_clarification = false;
      }
    }

    setProposal({ ...proposal, tasks: updated });
  };

  const toggleTaskUpdate = (taskId) => {
    setTaskUpdatesIncluded((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleConflictChoice = (conflictIndex, resolution) => {
    setConflictChoices((prev) => ({
      ...prev,
      [conflictIndex]: resolution,
    }));
  };

  // Determine if confirm is disabled:
  // "The Confirm button stays disabled until every decision conflict has a choice."
  const decisionConflicts = (proposal?.conflicts || []).filter(
    (c) => c.type === 'decision_conflict'
  );

  const pendingDecisionConflicts = decisionConflicts.filter((_, idx) => {
    // Find the original index in proposal.conflicts
    const originalIdx = proposal.conflicts.findIndex(
      (c) => c.type === 'decision_conflict' && c.title === decisionConflicts[idx].title
    );
    return !conflictChoices[originalIdx];
  });

  const isConfirmDisabled = decisionConflicts.length > 0 && pendingDecisionConflicts.length > 0;

  const handleConfirmAndSave = async () => {
    if (!proposal || isConfirmDisabled) return;
    setSaving(true);
    setError(null);

    try {
      // Build conflict resolutions array
      const conflictResolutionsList = (proposal.conflicts || []).map((c, idx) => {
        const choice = conflictChoices[idx] || (c.type === 'decision_conflict' ? 'kept_new' : 'acknowledged');
        return {
          conflict_index: idx,
          type: c.type,
          title: c.title,
          resolution: choice,
          topic: c.old_decision_id ? c.title.replace("Conflict on '", '').replace("'", '') : null,
          old_decision_id: c.old_decision_id,
        };
      });

      // Filter included task updates
      const includedUpdates = (proposal.task_updates || []).filter(
        (tu) => taskUpdatesIncluded[tu.task_id] !== false
      );

      const res = await fetch('/api/meetings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: proposal.title,
          meeting_date: proposal.meeting_date,
          transcript: proposal.transcript,
          decisions: proposal.decisions,
          tasks: proposal.tasks,
          task_updates: includedUpdates,
          conflict_resolutions: conflictResolutionsList,
          conflicts: proposal.conflicts || [],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to confirm meeting');
      }

      const savedMeeting = await res.json();
      setSuccessMessage(
        `Meeting "${savedMeeting.title}" confirmed! Decisions: ${savedMeeting.decisions.length}, Tasks: ${savedMeeting.tasks.length}, Conflicts logged: ${savedMeeting.conflicts.length}`
      );
      setProposal(null);
      if (onMeetingSaved) {
        onMeetingSaved(savedMeeting);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderConfidenceBadge = (confidence) => {
    const confVal = typeof confidence === 'number' ? confidence : 0.8;
    const percentage = Math.round(confVal * 100);

    if (confVal >= 0.85) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {percentage}% Confidence
        </span>
      );
    }
    if (confVal >= 0.6) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-950/70 text-amber-300 border border-amber-700/60 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          {percentage}% Confidence
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-950/70 text-rose-300 border border-rose-700/60 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
        {percentage}% Confidence
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            New Meeting Analysis
          </h2>
          <p className="text-sm text-slate-400">
            Memory-aware extraction of decisions, task updates, commitments, and cross-meeting conflicts.
          </p>
        </div>

        {/* Demo Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium whitespace-nowrap">
            Load Demo:
          </label>
          <select
            value={selectedDemoId}
            onChange={handleSelectDemo}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
          >
            <option value="">Select a demo meeting...</option>
            {demoMeetings.map((dm) => (
              <option key={dm.id} value={dm.id}>
                {dm.title} ({dm.meeting_date})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Analysis Notice</p>
            <p className="text-rose-300/90 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Meeting Confirmed</p>
            <p className="text-emerald-300/90 text-xs mt-0.5">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-400 underline hover:text-emerald-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Form Input View */}
      {!proposal ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Meeting Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sprint Planning #14"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Meeting Date
                </label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Upload .txt Transcript
                </label>
                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 border-dashed rounded-xl cursor-pointer text-xs font-medium text-slate-300 transition-colors">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Choose file (.txt)</span>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={loading || !transcript.trim()}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                  loading || !transcript.trim()
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Analyzing with Groq AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Analyze with AI</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1.5 leading-relaxed">
              <p className="font-semibold text-slate-300">🧠 Cross-Meeting Memory Active</p>
              <p>
                Checks open tasks and active decisions to detect rescheduled deadlines, status completions, workload limits, and policy conflicts.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl min-h-[460px]">
            <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Raw Meeting Transcript
              </span>
              <span className="text-xs text-slate-500">
                {transcript.split('\n').filter((l) => l.trim()).length} lines
              </span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste transcript here..."
              className="flex-1 w-full bg-slate-950 p-4 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        </div>
      ) : (
        /* PROPOSAL SCREEN (WITH CONFLICTS & UPDATES) */
        <div className="space-y-6">
          {/* 1. Cached Demo Banner if applicable */}
          {proposal.cached_demo && (
            <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-600/60 text-amber-200 text-xs font-medium flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>CACHED DEMO RESPONSE</strong> — not live AI (DEMO_FALLBACK enabled). Set GROQ_API_KEY for live inferences.
              </span>
            </div>
          )}

          {/* Proposal Header Banner */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Step 2: Human Review & Confirmation
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {proposal.meeting_date}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">
                Proposal for: {proposal.title}
              </h3>
              <p className="text-xs text-slate-400">
                Review conflicts, task updates, and proposed commitments before committing to memory.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setProposal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Back to Edit Input
              </button>
              <button
                onClick={handleConfirmAndSave}
                disabled={saving || isConfirmDisabled}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                  isConfirmDisabled
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
                title={isConfirmDisabled ? 'Select a choice for all decision conflicts first' : ''}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to SQLite...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Save Everything</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2-Column Proposal Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Proposal Sections */}
            <div className="lg:col-span-7 space-y-6">

              {/* 2. RED SECTION: CONFLICTS FOUND */}
              {proposal.conflicts && proposal.conflicts.length > 0 && (
                <div className="space-y-3 p-4 rounded-2xl bg-rose-950/20 border border-rose-900/60 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      Conflicts Found ({proposal.conflicts.length})
                    </h4>
                    {isConfirmDisabled && (
                      <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800">
                        Choose resolution for {pendingDecisionConflicts.length} decision conflict(s)
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {proposal.conflicts.map((conf, idx) => {
                      const isDecisionConflict = conf.type === 'decision_conflict';
                      const currentChoice = conflictChoices[idx];

                      return (
                        <div
                          key={idx}
                          className="p-4 bg-slate-900/95 border border-rose-900/80 rounded-2xl space-y-3 shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {conf.type === 'decision_conflict' && (
                                <Shuffle className="w-4 h-4 text-amber-400" />
                              )}
                              {conf.type === 'workload_overload' && (
                                <Users className="w-4 h-4 text-rose-400" />
                              )}
                              {conf.type === 'dependency_conflict' && (
                                <GitBranch className="w-4 h-4 text-cyan-400" />
                              )}
                              <span className="text-xs font-bold text-white">
                                {conf.title}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                              {conf.type.replace('_', ' ')}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed font-medium">
                            {conf.description}
                          </p>

                          {/* Decision Conflict Comparison Card */}
                          {isDecisionConflict && (
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center text-xs">
                                {/* Old Value */}
                                <div className="sm:col-span-5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                                  <span className="block text-[10px] uppercase text-slate-500 font-semibold">
                                    Previous: {conf.old_meeting_title || 'Earlier'} ({conf.old_meeting_date})
                                  </span>
                                  <span className="font-bold text-amber-300 font-mono text-xs">
                                    {conf.old_value}
                                  </span>
                                </div>

                                <div className="sm:col-span-1 flex justify-center text-slate-500">
                                  <ArrowRight className="w-4 h-4" />
                                </div>

                                {/* New Value */}
                                <div className="sm:col-span-5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                                  <span className="block text-[10px] uppercase text-slate-500 font-semibold">
                                    Proposed Value
                                  </span>
                                  <span className="font-bold text-emerald-300 font-mono text-xs">
                                    {conf.new_value}
                                  </span>
                                </div>
                              </div>

                              {/* Decision Conflict Choice Buttons */}
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleConflictChoice(idx, 'kept_new')}
                                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    currentChoice === 'kept_new'
                                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {currentChoice === 'kept_new' && <Check className="w-3.5 h-3.5" />}
                                  <span>Keep new decision</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConflictChoice(idx, 'kept_old')}
                                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    currentChoice === 'kept_old'
                                      ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {currentChoice === 'kept_old' && <Check className="w-3.5 h-3.5" />}
                                  <span>Keep old decision</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Workload Overload or Dependency Conflict Card */}
                          {!isDecisionConflict && (
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                              {conf.related_titles && conf.related_titles.length > 0 && (
                                <div className="text-xs space-y-1">
                                  <span className="text-[10px] uppercase text-slate-500 font-semibold">
                                    Related Deliverables:
                                  </span>
                                  <ul className="list-disc list-inside text-slate-300 space-y-0.5 font-medium pl-1">
                                    {conf.related_titles.map((rt, r_idx) => (
                                      <li key={r_idx}>{rt}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] text-slate-400">
                                  Acknowledge this schedule friction to proceed:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleConflictChoice(idx, 'acknowledged')}
                                  className={`py-1 px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    currentChoice === 'acknowledged'
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {currentChoice === 'acknowledged' ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                      <span>Acknowledged</span>
                                    </>
                                  ) : (
                                    <span>Acknowledge</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. BLUE SECTION: UPDATES TO EXISTING TASKS */}
              {proposal.task_updates && proposal.task_updates.length > 0 && (
                <div className="space-y-3 p-4 rounded-2xl bg-blue-950/20 border border-blue-900/60 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-400" />
                      Updates to Existing Tasks ({proposal.task_updates.length})
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {proposal.task_updates.map((tu) => {
                      const isIncluded = taskUpdatesIncluded[tu.task_id] !== false;

                      return (
                        <div
                          key={tu.task_id}
                          className={`p-4 bg-slate-900 border rounded-2xl space-y-3 shadow-md transition-all ${
                            isIncluded
                              ? 'border-blue-800/80'
                              : 'border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={() => toggleTaskUpdate(tu.task_id)}
                                className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500 cursor-pointer"
                              />
                              <div>
                                <h5 className="text-sm font-bold text-white tracking-tight">
                                  {tu.task_title}
                                </h5>
                                <span className="text-xs text-slate-400">
                                  Owner: <strong>{tu.owner || 'Unassigned'}</strong>
                                </span>
                              </div>
                            </div>

                            {renderConfidenceBadge(tu.confidence)}
                          </div>

                          {/* Transition Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {tu.new_status && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-semibold">
                                <span className="text-slate-400 uppercase">{tu.old_status || 'PENDING'}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                                <span className={tu.new_status === 'done' ? 'text-emerald-400 uppercase font-bold' : 'text-rose-400 uppercase font-bold'}>
                                  {tu.new_status.toUpperCase()}
                                </span>
                              </div>
                            )}

                            {tu.new_deadline && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-semibold">
                                <span className="text-slate-400">Due: {tu.old_deadline || 'None'}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-amber-300 font-bold">
                                  {tu.new_deadline}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Evidence Quote */}
                          <div
                            onClick={() => setActiveQuote(tu)}
                            className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 cursor-pointer group transition-all"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                              <span className="flex items-center gap-1 group-hover:text-blue-400">
                                <Quote className="w-3 h-3 text-blue-400" />
                                Evidence Quote
                              </span>
                              <span className="text-[10px] group-hover:text-blue-300 underline">
                                Locate in transcript &rarr;
                              </span>
                            </div>
                            <p className="text-xs italic text-slate-300 group-hover:text-white font-serif">
                              "{tu.evidence_quote}"
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. AGREED DECISIONS SECTION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    Agreed Decisions ({proposal.decisions.length})
                  </h4>
                </div>

                {proposal.decisions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 bg-slate-900 rounded-xl border border-slate-800">
                    No decisions agreed upon in this transcript.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {proposal.decisions.map((dec, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-all shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                              topic: {dec.topic}
                            </span>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700">
                              val: {dec.value}
                            </span>
                          </div>
                          {renderConfidenceBadge(dec.confidence)}
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold uppercase text-slate-500">
                            Summary Description
                          </label>
                          <input
                            type="text"
                            value={dec.text}
                            onChange={(e) =>
                              updateDecisionField(idx, 'text', e.target.value)
                            }
                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div
                          onClick={() => setActiveQuote(dec)}
                          className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 cursor-pointer group transition-all"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span className="flex items-center gap-1 group-hover:text-amber-400">
                              <Quote className="w-3 h-3 text-indigo-400" />
                              Evidence Quote
                            </span>
                            <span className="text-[10px] group-hover:text-amber-300 underline">
                              Locate in transcript &rarr;
                            </span>
                          </div>
                          <p className="text-xs italic text-slate-300 group-hover:text-white font-serif">
                            "{dec.evidence_quote}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. NEW TASKS SECTION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    New Action Items ({proposal.tasks.length})
                  </h4>
                </div>

                {proposal.tasks.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 bg-slate-900 rounded-xl border border-slate-800">
                    No new tasks detected in this transcript.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {proposal.tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className={`p-4 bg-slate-900 border rounded-2xl space-y-3 shadow-md transition-all ${
                          task.needs_clarification
                            ? 'border-amber-700/80 ring-1 ring-amber-600/30'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) =>
                              updateTaskField(idx, 'title', e.target.value)
                            }
                            className="flex-1 bg-transparent border-b border-dashed border-slate-700 hover:border-slate-500 pb-1 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500"
                          />
                          {renderConfidenceBadge(task.confidence)}
                        </div>

                        {/* Dependency Display */}
                        {task.depends_on_title && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 text-xs font-medium">
                            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Waits for: <strong>{task.depends_on_title}</strong></span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-indigo-400" />
                              Owner
                            </label>
                            <input
                              type="text"
                              placeholder="Unassigned (No guess)"
                              value={task.owner || ''}
                              onChange={(e) =>
                                updateTaskField(idx, 'owner', e.target.value)
                              }
                              className={`w-full mt-1 bg-slate-950 border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                !task.owner
                                  ? 'border-amber-700/80 text-amber-300 placeholder-amber-500/50'
                                  : 'border-slate-800 text-slate-200'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-indigo-400" />
                              Deadline (YYYY-MM-DD)
                            </label>
                            <input
                              type="text"
                              placeholder="YYYY-MM-DD or null"
                              value={task.deadline || ''}
                              onChange={(e) =>
                                updateTaskField(idx, 'deadline', e.target.value)
                              }
                              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {task.needs_clarification && (
                          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Needs Clarification</span>
                            </div>
                            <p className="text-xs text-amber-200/90 font-medium">
                              {task.clarification_question ||
                                'Owner or deadline is missing. Please fill in above to confirm.'}
                            </p>
                          </div>
                        )}

                        <div
                          onClick={() => setActiveQuote(task)}
                          className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 cursor-pointer group transition-all"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span className="flex items-center gap-1 group-hover:text-amber-400">
                              <Quote className="w-3 h-3 text-indigo-400" />
                              Evidence Quote
                            </span>
                            <span className="text-[10px] group-hover:text-amber-300 underline">
                              Locate in transcript &rarr;
                            </span>
                          </div>
                          <p className="text-xs italic text-slate-300 group-hover:text-white font-serif">
                            "{task.evidence_quote}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Confirm Button */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  {isConfirmDisabled && (
                    <span className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Resolution required for decision conflicts above before confirming.
                    </span>
                  )}
                </div>

                <button
                  onClick={handleConfirmAndSave}
                  disabled={saving || isConfirmDisabled}
                  className={`px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
                    isConfirmDisabled
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  }`}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving to SQLite...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Confirm & Save Everything</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right 5 Cols: Transcript Inspector */}
            <div className="lg:col-span-5 h-[calc(100vh-180px)] sticky top-24">
              <TranscriptHighlighter
                transcript={proposal.transcript}
                activeQuote={activeQuote}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
