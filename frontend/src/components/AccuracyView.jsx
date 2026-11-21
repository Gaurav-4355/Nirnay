import React, { useState, useEffect } from 'react';
import {
  Award,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileDown,
  Info,
} from 'lucide-react';

export default function AccuracyView({ showToast }) {
  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evalJob, setEvalJob] = useState({ state: 'idle', progress: '' });
  const [expandedMeeting, setExpandedMeeting] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchLatest = () => {
    setLoading(true);
    fetch('/api/eval/latest')
      .then((res) => {
        if (!res.ok) throw new Error('No eval data');
        return res.json();
      })
      .then((data) => {
        setEvalData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const checkStatus = () => {
    fetch('/api/eval/status')
      .then((res) => res.json())
      .then((status) => {
        setEvalJob(status);
        if (status.state === 'done') {
          if (status.result) setEvalData(status.result);
          if (showToast) showToast('Evaluation completed successfully!', 'success');
        } else if (status.state === 'error') {
          if (showToast) showToast(`Evaluation error: ${status.error}`, 'error');
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLatest();
    checkStatus();
  }, []);

  // Poll while running
  useEffect(() => {
    if (evalJob.state !== 'running') return;
    const interval = setInterval(() => {
      fetch('/api/eval/status')
        .then((res) => res.json())
        .then((status) => {
          setEvalJob(status);
          if (status.state === 'done') {
            if (status.result) setEvalData(status.result);
            if (showToast) showToast('Live evaluation finished!', 'success');
          } else if (status.state === 'error') {
            if (showToast) showToast(`Eval failed: ${status.error}`, 'error');
          }
        })
        .catch(() => {});
    }, 1500);

    return () => clearInterval(interval);
  }, [evalJob.state]);

  const handleRunEvaluation = async () => {
    try {
      const res = await fetch('/api/eval/run', { method: 'POST' });
      if (res.ok) {
        setEvalJob({ state: 'running', progress: 'Starting pipeline...' });
        if (showToast) showToast('Evaluation job launched in background.', 'info');
      } else {
        const err = await res.json().catch(() => ({}));
        if (showToast) showToast(err.detail || 'Failed to start evaluation', 'error');
      }
    } catch (e) {
      if (showToast) showToast('Network error starting evaluation', 'error');
    }
  };

  const handleExportSnapshot = async () => {
    if (!evalData) return;
    setExporting(true);
    try {
      const res = await fetch('/api/eval/export-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evalData),
      });
      if (res.ok) {
        if (showToast) showToast('Benchmark snapshot exported to backend/seed/eval_snapshot.json', 'success');
      }
    } catch (e) {
      if (showToast) showToast('Failed to export snapshot', 'error');
    } finally {
      setExporting(false);
    }
  };

  const summary = evalData?.summary;
  const isRunning = evalJob.state === 'running';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-400" />
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Pipeline Accuracy Scoreboard
            </h2>
            {evalData?.snapshot && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                Snapshot ({new Date(evalData.evaluated_at).toLocaleDateString()})
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Honest, automated evaluation of Nirnay's extraction, memory, and conflict detection against hand-annotated ground truth.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {evalData && (
            <button
              onClick={handleExportSnapshot}
              disabled={exporting || isRunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
              title="Save current results as default snapshot"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-400" />
              <span>{exporting ? 'Saving...' : 'Export Snapshot'}</span>
            </button>
          )}

          <button
            onClick={handleRunEvaluation}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40 transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Evaluating...' : 'Run Evaluation (3 AI Calls)'}</span>
          </button>
        </div>
      </div>

      {/* Progress Box while running */}
      {isRunning && (
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-xs text-amber-200 flex items-center gap-3 shadow-lg animate-pulse">
          <RotateCw className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
          <div className="flex-1">
            <strong className="block text-white text-sm font-semibold">Evaluation in Progress</strong>
            <p className="text-amber-300/90 font-mono mt-0.5">{evalJob.progress || 'Processing seed meetings...'}</p>
          </div>
        </div>
      )}

      {/* Honest Benchmark Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block font-semibold mb-0.5">Evaluation Scope & Integrity:</strong>
          <p className="leading-relaxed text-slate-400">
            Measured on 3 demo meetings we wrote ourselves: a small test set, not a general benchmark. The evaluation sandbox initializes an isolated in-memory SQLite database, executes live LLM extraction for each transcript, applies previous context, and strictly checks decisions, tasks, status updates, exact quote matches, and conflict detection.
          </p>
        </div>
      </div>

      {/* Big KPI Cards */}
      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Overall Recall */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-800/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Overall Recall</span>
            <div className="text-2xl font-black text-white font-mono">{summary.overall_recall}%</div>
            <p className="text-[10px] text-slate-400">Across all 4 categories</p>
          </div>

          {/* Decisions */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Decisions</span>
            <div className="text-xl font-black text-white font-mono">{summary.decisions.recall}%</div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono">
              <span>P: {summary.decisions.precision}%</span>
              <span>{summary.decisions.correct}/{summary.decisions.expected}</span>
            </div>
          </div>

          {/* Tasks */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">New Tasks</span>
            <div className="text-xl font-black text-white font-mono">{summary.tasks.recall}%</div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono">
              <span>P: {summary.tasks.precision}%</span>
              <span>{summary.tasks.correct}/{summary.tasks.expected}</span>
            </div>
          </div>

          {/* Task Updates */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Task Updates</span>
            <div className="text-xl font-black text-white font-mono">{summary.task_updates.recall}%</div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono">
              <span>P: {summary.task_updates.precision}%</span>
              <span>{summary.task_updates.correct}/{summary.task_updates.expected}</span>
            </div>
          </div>

          {/* Conflicts */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Conflicts</span>
            <div className="text-xl font-black text-white font-mono">{summary.conflicts.recall}%</div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono">
              <span>P: {summary.conflicts.precision}%</span>
              <span>{summary.conflicts.correct}/{summary.conflicts.expected}</span>
            </div>
          </div>

          {/* Evidence Validity */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Quote Validity</span>
            <div className="text-xl font-black text-white font-mono">{summary.evidence_validity}%</div>
            <p className="text-[10px] text-slate-400">Verbatim quote match</p>
          </div>

          {/* Clarification No-Guess */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">No-Guess Rate</span>
            <div className="text-xl font-black text-white font-mono">{summary.no_guess_rate}%</div>
            <p className="text-[10px] text-slate-400">Owner left unassigned</p>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400 text-xs">
          Loading evaluation metrics...
        </div>
      )}

      {/* Per-Meeting Breakdown */}
      {evalData?.meetings && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Per-Meeting Test Results</span>
          </h3>

          <div className="space-y-3">
            {evalData.meetings.map((m) => {
              const isExpanded = expandedMeeting === m.meeting_id;
              const hasMissed =
                m.decisions?.missed?.length > 0 ||
                m.tasks?.missed?.length > 0 ||
                m.task_updates?.missed?.length > 0 ||
                m.conflicts?.missed?.length > 0;
              const hasExtra =
                m.decisions?.extra?.length > 0 ||
                m.tasks?.extra?.length > 0 ||
                m.task_updates?.extra?.length > 0 ||
                m.conflicts?.extra?.length > 0;

              return (
                <div
                  key={m.meeting_id}
                  className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden transition-all"
                >
                  {/* Meeting Row Bar */}
                  <div
                    onClick={() => setExpandedMeeting(isExpanded ? null : m.meeting_id)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{m.title}</span>
                        <span className="text-xs text-slate-500 font-mono">({m.meeting_date})</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-500">Decisions:</span>
                          <span className="font-mono text-white font-semibold">
                            {m.decisions.correct}/{m.decisions.expected}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-500">Tasks:</span>
                          <span className="font-mono text-white font-semibold">
                            {m.tasks.correct}/{m.tasks.expected}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-500">Updates:</span>
                          <span className="font-mono text-white font-semibold">
                            {m.task_updates.correct}/{m.task_updates.expected}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-500">Conflicts:</span>
                          <span className="font-mono text-white font-semibold">
                            {m.conflicts.correct}/{m.conflicts.expected}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!hasMissed && !hasExtra ? (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>100% Match</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Discrepancies</span>
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Missed & Extra details */}
                  {isExpanded && (
                    <div className="p-5 border-t border-slate-800/80 bg-slate-950/50 space-y-4 text-xs">
                      {/* Missed Items */}
                      <div>
                        <h4 className="font-bold text-rose-400 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Missed Items (Expected but not found)</span>
                        </h4>
                        {!hasMissed ? (
                          <p className="text-slate-500 italic">None. All expected items were captured.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {m.decisions?.missed?.map((d, i) => (
                              <div key={i} className="p-2 rounded bg-rose-950/30 border border-rose-900/40 text-slate-300">
                                <strong className="text-rose-300">[Decision]</strong> {d.topic}: "{d.value}" - {d.text}
                              </div>
                            ))}
                            {m.tasks?.missed?.map((t, i) => (
                              <div key={i} className="p-2 rounded bg-rose-950/30 border border-rose-900/40 text-slate-300">
                                <strong className="text-rose-300">[Task]</strong> {t.title} (@{t.owner || 'Unassigned'}, due: {t.deadline || 'None'})
                              </div>
                            ))}
                            {m.task_updates?.missed?.map((u, i) => (
                              <div key={i} className="p-2 rounded bg-rose-950/30 border border-rose-900/40 text-slate-300">
                                <strong className="text-rose-300">[Update]</strong> {u.title_keyword} -&gt; status: {u.new_status}, deadline: {u.new_deadline}
                              </div>
                            ))}
                            {m.conflicts?.missed?.map((c, i) => (
                              <div key={i} className="p-2 rounded bg-rose-950/30 border border-rose-900/40 text-slate-300">
                                <strong className="text-rose-300">[Conflict]</strong> {c.type}: {c.description}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Extra Items */}
                      <div>
                        <h4 className="font-bold text-amber-400 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Extra Items (Found but unmapped)</span>
                        </h4>
                        {!hasExtra ? (
                          <p className="text-slate-500 italic">None. No extraneous items produced.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {m.tasks?.extra?.map((t, i) => (
                              <div key={i} className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-slate-300">
                                <strong className="text-amber-300">[Task]</strong> {t.title} (@{t.owner || 'Unassigned'})
                              </div>
                            ))}
                            {m.decisions?.extra?.map((d, i) => (
                              <div key={i} className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-slate-300">
                                <strong className="text-amber-300">[Decision]</strong> {d.topic}: "{d.value}"
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
