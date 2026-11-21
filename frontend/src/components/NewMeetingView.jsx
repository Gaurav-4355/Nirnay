import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Quote,
  Clock,
  ArrowRight,
  RotateCcw,
  Plus,
  Send,
  Compass,
  CheckSquare,
} from 'lucide-react';
import TranscriptHighlighter from './TranscriptHighlighter';
import ConfidenceMark from '../ui/ConfidenceMark';
import Avatar from '../ui/Avatar';
import RedPenStrike from '../ui/RedPenStrike';
import StampBadge from '../ui/StampBadge';

export default function NewMeetingView({ onMeetingSaved, showToast }) {
  const [step, setStep] = useState('paste'); // 'paste' | 'review' | 'saved'
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [transcript, setTranscript] = useState('');
  const [demoMeetings, setDemoMeetings] = useState([]);
  const [selectedDemoId, setSelectedDemoId] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState(null);

  // Proposal state
  const [proposal, setProposal] = useState(null);
  const [activeQuote, setActiveQuote] = useState(null);

  // Conflict resolutions: mapped by conflict index: "kept_new" | "kept_old" | "acknowledged"
  const [conflictChoices, setConflictChoices] = useState({});

  // Task updates toggles: mapped by task_id -> boolean
  const [taskUpdatesIncluded, setTaskUpdatesIncluded] = useState({});

  // Saved result summary state
  const [savedSummary, setSavedSummary] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/seed/demo-meetings')
      .then((res) => res.json())
      .then((data) => setDemoMeetings(data))
      .catch((err) => console.error('Error fetching demo meetings:', err));
  }, []);

  // Timer for real elapsed seconds while analyzing
  useEffect(() => {
    let interval = null;
    if (loading) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSelectDemo = (demoId) => {
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
      setError('Please provide a meeting transcript to read.');
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
        throw new Error(errData.detail || 'Failed to read meeting transcript');
      }

      const data = await res.json();
      setProposal(data);

      // Initialize task updates inclusion map (default all true)
      const incMap = {};
      (data.task_updates || []).forEach((tu) => {
        incMap[tu.task_id] = true;
      });
      setTaskUpdatesIncluded(incMap);

      setStep('review');
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
  // Approve is disabled until all decision conflicts are settled
  const decisionConflicts = (proposal?.conflicts || []).filter(
    (c) => c.type === 'decision_conflict'
  );

  const pendingConflictsCount = decisionConflicts.filter((c) => {
    const originalIdx = proposal.conflicts.findIndex(
      (orig) => orig.type === 'decision_conflict' && orig.title === c.title
    );
    return !conflictChoices[originalIdx];
  }).length;

  const isConfirmDisabled = pendingConflictsCount > 0;

  const handleConfirmAndSave = async () => {
    if (!proposal || isConfirmDisabled) return;
    setSaving(true);
    setError(null);

    try {
      const conflictResolutionsList = (proposal.conflicts || []).map((c, idx) => {
        const choice =
          conflictChoices[idx] ||
          (c.type === 'decision_conflict' ? 'kept_new' : 'acknowledged');
        return {
          conflict_index: idx,
          type: c.type,
          title: c.title,
          resolution: choice,
          topic: c.old_decision_id
            ? c.title.replace("Conflict on '", '').replace("'", '')
            : null,
          old_decision_id: c.old_decision_id,
        };
      });

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
        throw new Error(errData.detail || 'Failed to approve and save meeting');
      }

      const savedMeeting = await res.json();
      setSavedSummary({
        title: savedMeeting.title,
        decisionsSaved: savedMeeting.decisions.length,
        tasksCreated: savedMeeting.tasks.length,
        conflictsLogged: savedMeeting.conflicts.length,
        updatesApplied: includedUpdates.length,
      });

      setStep('saved');
      if (onMeetingSaved) {
        onMeetingSaved(savedMeeting);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartAnother = () => {
    setTitle('');
    setTranscript('');
    setSelectedDemoId('');
    setProposal(null);
    setSavedSummary(null);
    setStep('paste');
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 bg-surface pb-32">
      {/* 3-step sequence indicator: thin, text-only */}
      <div className="flex items-center gap-3 text-[13px] border-b border-line pb-4">
        <span
          className={`font-semibold transition-colors ${
            step === 'paste' ? 'text-ink' : 'text-ink-faint'
          }`}
        >
          1. Paste
        </span>
        <span className="text-[#e7e9ee]">—</span>
        <span
          className={`font-semibold transition-colors ${
            step === 'review' ? 'text-ink' : 'text-ink-faint'
          }`}
        >
          2. Review
        </span>
        <span className="text-[#e7e9ee]">—</span>
        <span
          className={`font-semibold transition-colors ${
            step === 'saved' ? 'text-ink' : 'text-ink-faint'
          }`}
        >
          3. Saved
        </span>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="p-4 rounded-[6px] bg-red-tint border border-red/30 text-red text-[14px] flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* STEP 1: PASTE */}
      {step === 'paste' && (
        <div className="space-y-6 max-w-[800px]">
          <div>
            <h1 className="text-[30px] font-bold text-ink tracking-[-0.02em] leading-tight">
              New meeting
            </h1>
            <p className="text-[13px] text-ink-soft mt-0.5">
              Paste or upload a meeting transcript. Nirnay extracts decisions, tracks tasks, and checks previous memory for clashes.
            </p>
          </div>

          {/* Title and Date Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[13px] font-medium text-ink">
                Meeting title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sprint 24 Planning, Launch Sync"
                className="w-full px-3 py-2 bg-surface border border-line-strong focus:border-accent rounded-[6px] text-[14px] text-ink placeholder-[#8a90a2]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-ink">
                Meeting date
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-line-strong focus:border-accent rounded-[6px] text-[14px] text-ink tabular-nums"
              />
            </div>
          </div>

          {/* Transcript Textarea (Serif spoken voice) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[13px] font-medium text-ink">
                Meeting transcript
              </label>
              <span className="text-[12px] text-ink-faint">
                Supports English, Hindi, and Hinglish dialogue
              </span>
            </div>
            <textarea
              rows={12}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste dialogue here... e.g.&#10;Rahul: We should move the launch to 5 Feb.&#10;Amit: Main backend APIs 28 Dec tak complete kar dunga."
              className="w-full p-4 bg-surface border border-line-strong focus:border-accent rounded-[6px] font-serif text-[15.5px] leading-relaxed text-ink placeholder-[#8a90a2]"
            />
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-[6px] text-[13px] font-medium bg-surface hover:bg-fill text-ink border border-line transition-colors"
              >
                Upload .txt
              </button>

              {/* Demo selector dropdown */}
              {demoMeetings.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-ink-faint">or demo:</span>
                  <select
                    value={selectedDemoId}
                    onChange={(e) => handleSelectDemo(e.target.value)}
                    className="px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium bg-surface border border-line text-ink focus:border-accent"
                  >
                    <option value="">Select demo meeting...</option>
                    {demoMeetings.map((dm) => (
                      <option key={dm.id} value={dm.id}>
                        {dm.title} ({dm.meeting_date})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading || !transcript.trim()}
                className="px-5 py-2 rounded-[6px] text-[14px] font-semibold bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-colors shadow-2xs"
              >
                {loading ? (
                  <span>Reading the meeting... {elapsedSeconds}s</span>
                ) : (
                  <span>Read this meeting</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW (Left 62% + Right 38% Sticky Transcript + Sticky Decision Bar) */}
      {step === 'review' && proposal && (
        <div className="space-y-8">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <div>
              <h1 className="text-[22px] font-semibold text-ink">
                Review record: {proposal.title}
              </h1>
              <p className="text-[13px] text-ink-soft mt-0.5 tabular-nums">
                {proposal.meeting_date} · Review extracted decisions, settle clashes, and approve.
              </p>
            </div>
            <button
              onClick={() => setStep('paste')}
              className="text-[13px] text-ink-soft hover:text-ink"
            >
              Edit transcript
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 62% Column (7.5/12) */}
            <div className="lg:col-span-7 space-y-8">
              {/* 1. Conflicts (Bordered 10px panel, 3px red-pen left border) */}
              {(proposal.conflicts || []).length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-[17px] font-semibold text-ink flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d0272d]"></span>
                    <span>Conflicts to settle ({proposal.conflicts.length})</span>
                  </h2>

                  <div className="space-y-3">
                    {proposal.conflicts.map((conf, idx) => {
                      const isDecisionConflict = conf.type === 'decision_conflict';
                      const choice = conflictChoices[idx];

                      return (
                        <div
                          key={idx}
                          className="p-4 bg-surface border border-line border-l-[3px] border-l-[#d0272d] rounded-[10px] space-y-3"
                        >
                          <div>
                            <span className="text-[12px] font-medium text-red">
                              {conf.title}
                            </span>
                            <p className="text-[14px] text-ink mt-1 font-sans leading-relaxed">
                              {conf.description}
                            </p>
                          </div>

                          {isDecisionConflict && (
                            <div className="flex items-center gap-3 pt-1">
                              <button
                                type="button"
                                onClick={() => handleConflictChoice(idx, 'kept_new')}
                                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium border transition-colors ${
                                  choice === 'kept_new'
                                    ? 'bg-green-tint text-green border-green'
                                    : 'bg-surface text-ink border-line hover:bg-fill'
                                }`}
                              >
                                Keep the new one
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConflictChoice(idx, 'kept_old')}
                                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium border transition-colors ${
                                  choice === 'kept_old'
                                    ? 'bg-amber-tint text-amber border-amber'
                                    : 'bg-surface text-ink border-line hover:bg-fill'
                                }`}
                              >
                                Keep the old one
                              </button>
                              {!choice && (
                                <span className="text-[12px] text-red font-medium">
                                  Action required
                                </span>
                              )}
                            </div>
                          )}

                          {!isDecisionConflict && (
                            <div className="flex items-center gap-2 pt-1">
                              <StampBadge status={choice || 'unresolved'} />
                              <button
                                type="button"
                                onClick={() => handleConflictChoice(idx, 'acknowledged')}
                                className="text-[12px] text-accent-text hover:underline"
                              >
                                Acknowledge clash
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 2. Updates to Existing Tasks */}
              {(proposal.task_updates || []).length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-[17px] font-semibold text-ink">
                    Updates to existing tasks ({proposal.task_updates.length})
                  </h2>

                  <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
                    {proposal.task_updates.map((tu) => {
                      const isIncluded = taskUpdatesIncluded[tu.task_id] !== false;

                      return (
                        <div key={tu.task_id} className="py-3 space-y-2">
                          <div className="flex items-center justify-between text-[14px]">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={() => toggleTaskUpdate(tu.task_id)}
                                className="rounded-[4px] border-line-strong text-accent-text focus:ring-0"
                              />
                              <span className="font-semibold text-ink">
                                {tu.existing_task_title || `Task #${tu.task_id}`}
                              </span>
                              <span className="text-ink-faint">—</span>
                              {tu.new_status && (
                                <span className="text-[13px] font-medium text-green">
                                  Status → {tu.new_status}
                                </span>
                              )}
                              {tu.new_deadline && (
                                <span className="text-[13px] font-medium text-accent-text tabular-nums">
                                  Deadline → {tu.new_deadline}
                                </span>
                              )}
                            </div>

                            <ConfidenceMark score={tu.confidence_score || 0.9} />
                          </div>

                          {tu.evidence_quote && (
                            <button
                              type="button"
                              onClick={() => setActiveQuote(tu.evidence_quote)}
                              className="text-left w-full pl-6 text-[13px] font-serif italic text-ink-soft hover:text-ink"
                            >
                              "{tu.evidence_quote}"
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 3. New Decisions (Ledger rows) */}
              <section className="space-y-3">
                <h2 className="text-[17px] font-semibold text-ink">
                  New decisions ({proposal.decisions?.length || 0})
                </h2>

                <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
                  {(proposal.decisions || []).map((dec, idx) => (
                    <div key={idx} className="py-3 space-y-1.5 text-[14px]">
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="w-36 shrink-0 font-medium text-ink">
                          {dec.topic?.replace(/_/g, ' ')}
                        </div>
                        <input
                          type="text"
                          value={dec.value}
                          onChange={(e) => updateDecisionField(idx, 'value', e.target.value)}
                          className="flex-1 px-2 py-1 bg-surface border border-transparent hover:border-line focus:border-accent rounded-[4px] font-semibold text-ink"
                        />
                        <ConfidenceMark score={dec.confidence_score || 0.95} />
                      </div>

                      {dec.evidence_quote && (
                        <button
                          type="button"
                          onClick={() => setActiveQuote(dec.evidence_quote)}
                          className="text-left w-full pl-36 text-[13px] font-serif italic text-ink-soft hover:text-ink truncate block"
                          title="Click to highlight in transcript"
                        >
                          "{dec.evidence_quote}"
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. New Tasks (Ledger rows with inline editable owner & deadline) */}
              <section className="space-y-3">
                <h2 className="text-[17px] font-semibold text-ink">
                  New tasks ({proposal.tasks?.length || 0})
                </h2>

                <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
                  {(proposal.tasks || []).map((task, idx) => {
                    const hasMissingOwner = !task.owner || task.owner.toLowerCase() === 'unassigned';

                    return (
                      <div key={idx} className="py-3 space-y-2 text-[14px]">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => updateTaskField(idx, 'title', e.target.value)}
                            className="flex-1 min-w-[200px] px-2 py-1 bg-surface border border-transparent hover:border-line focus:border-accent rounded-[4px] font-medium text-ink"
                          />

                          <div className="flex items-center gap-3">
                            {/* Inline owner field */}
                            <div className="flex items-center gap-1.5">
                              <Avatar name={task.owner} size="xs" />
                              {hasMissingOwner ? (
                                <input
                                  type="text"
                                  value={task.owner || ''}
                                  onChange={(e) => updateTaskField(idx, 'owner', e.target.value)}
                                  placeholder="Who owns this?"
                                  className="w-28 text-[12px] font-medium text-amber placeholder-[#b26b00] border-b border-amber bg-transparent focus:outline-none"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={task.owner}
                                  onChange={(e) => updateTaskField(idx, 'owner', e.target.value)}
                                  className="w-24 text-[13px] text-ink font-medium border-b border-transparent hover:border-line focus:border-accent bg-transparent focus:outline-none"
                                />
                              )}
                            </div>

                            {/* Inline deadline field */}
                            <input
                              type="date"
                              value={task.deadline || ''}
                              onChange={(e) => updateTaskField(idx, 'deadline', e.target.value)}
                              className="text-[12px] text-ink-soft border-b border-transparent hover:border-line focus:border-accent bg-transparent tabular-nums focus:outline-none"
                            />

                            <ConfidenceMark score={task.confidence_score || 0.9} />
                          </div>
                        </div>

                        {task.evidence_quote && (
                          <button
                            type="button"
                            onClick={() => setActiveQuote(task.evidence_quote)}
                            className="text-left text-[13px] font-serif italic text-ink-soft hover:text-ink truncate block"
                            title="Click to highlight in transcript"
                          >
                            "{task.evidence_quote}"
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Right 38% Column (5/12): Sticky Transcript Inspector */}
            <div className="lg:col-span-5 sticky top-20 h-[640px]">
              <TranscriptHighlighter
                transcript={proposal.transcript}
                activeQuote={activeQuote}
              />
            </div>
          </div>

          {/* STICKY DECISION BAR */}
          <div className="fixed bottom-0 left-[248px] right-0 bg-surface border-t border-line px-8 py-3.5 z-40 shadow-elevated flex items-center justify-between">
            <div className="flex items-center gap-3 text-[14px] text-ink-soft">
              {pendingConflictsCount > 0 ? (
                <span className="font-semibold text-red tabular-nums">
                  {pendingConflictsCount} {pendingConflictsCount === 1 ? 'conflict' : 'conflicts'} left to settle
                </span>
              ) : (
                <span className="font-semibold text-green flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> All conflicts settled
                </span>
              )}
              <span>·</span>
              <span className="tabular-nums">
                {Object.values(taskUpdatesIncluded).filter(Boolean).length}{' '}
                {Object.values(taskUpdatesIncluded).filter(Boolean).length === 1 ? 'update' : 'updates'}
              </span>
              <span>·</span>
              <span className="tabular-nums">
                {proposal.tasks?.length || 0} {proposal.tasks?.length === 1 ? 'new task' : 'new tasks'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('paste')}
                className="px-4 py-2 rounded-[6px] text-[13px] font-medium bg-surface hover:bg-fill text-ink border border-line transition-colors"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSave}
                disabled={saving || isConfirmDisabled}
                className="px-5 py-2 rounded-[6px] text-[14px] font-semibold bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors shadow-2xs flex items-center gap-2"
                title={isConfirmDisabled ? 'Settle all decision conflicts before approving' : undefined}
              >
                {saving ? (
                  <span>Saving...</span>
                ) : (
                  <span>Approve and save</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: SAVED (Stamp scales in once over 300ms + Plain summary) */}
      {step === 'saved' && savedSummary && (
        <div className="py-12 max-w-[640px] mx-auto text-center space-y-6">
          {/* Animated Stamp */}
          <div className="inline-block animate-stamp">
            <div className="px-6 py-2 rounded-[8px] border-2 border-dashed border-green text-green font-bold text-[18px] tracking-wide uppercase select-none">
              Saved to memory
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-[22px] font-bold text-ink">
              {savedSummary.title}
            </h2>
            <p className="text-[15px] text-ink-soft leading-relaxed tabular-nums">
              {savedSummary.decisionsSaved} decisions saved
              {savedSummary.conflictsLogged > 0 ? `, ${savedSummary.conflictsLogged} conflicts resolved` : ''} ·{' '}
              {savedSummary.tasksCreated} tasks created ·{' '}
              {savedSummary.updatesApplied} updates applied
            </p>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleStartAnother}
              className="px-4 py-2 rounded-[6px] text-[14px] font-semibold bg-accent hover:bg-accent-hover text-white transition-colors"
            >
              Read another meeting
            </button>
            <button
              onClick={() => onMeetingSaved && onMeetingSaved()}
              className="px-4 py-2 rounded-[6px] text-[14px] font-medium bg-surface hover:bg-fill text-ink border border-line transition-colors"
            >
              Return to Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
