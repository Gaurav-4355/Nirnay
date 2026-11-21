import React, { useState, useEffect } from 'react';
import {
  Award,
  Play,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Info,
  ChevronDown,
  ChevronUp,
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
          if (showToast) showToast('Evaluation completed successfully.', 'success');
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
            if (showToast) showToast('Live evaluation finished.', 'success');
          } else if (status.state === 'error') {
            if (showToast) showToast(`Evaluation failed: ${status.error}`, 'error');
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
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 bg-surface">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-[30px] font-bold text-ink tracking-[-0.02em] leading-tight">
            How accurate is Nirnay?
          </h1>
          <p className="text-[15px] text-ink-soft mt-1">
            {summary
              ? `Across 3 test meetings Nirnay found ${summary.overall_recall}% of what it should have.`
              : 'Automated evaluation against hand-annotated ground truth.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {evalData && (
            <button
              onClick={handleExportSnapshot}
              disabled={exporting || isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium bg-surface hover:bg-fill text-ink border border-line transition-colors"
              title="Save current results as default snapshot"
            >
              <FileDown className="w-3.5 h-3.5 text-ink-soft" />
              <span>{exporting ? 'Saving...' : 'Export snapshot'}</span>
            </button>
          )}

          <button
            onClick={handleRunEvaluation}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition-colors"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Evaluating...' : 'Run evaluation'}</span>
          </button>
        </div>
      </div>

      {/* Progress Box while running */}
      {isRunning && (
        <div className="p-4 rounded-[6px] bg-fill border border-accent text-[13px] text-ink flex items-center gap-3">
          <RotateCw className="w-4 h-4 text-accent-text animate-spin shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-ink">Evaluation in progress:</span>{' '}
            <span className="text-ink-soft tabular-nums">{evalJob.progress || 'Processing seed meetings...'}</span>
          </div>
        </div>
      )}

      {/* Visible Note: Hand-annotated demo meetings */}
      <div className="p-3.5 rounded-[6px] bg-fill border border-line text-[13px] text-ink-soft flex items-start gap-2.5">
        <Info className="w-4 h-4 text-ink-soft shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-ink">Note on test set:</strong> This evaluation measures the pipeline against 3 demo meetings we authored ourselves with hand-annotated expected decisions, tasks, deadline changes, and conflicts. The test runs in an isolated in-memory SQLite sandbox with live LLM extraction.
        </div>
      </div>

      {/* Clean Tabular View */}
      {summary ? (
        <div className="border border-line rounded-[8px] overflow-hidden bg-surface">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-fill text-[12px] font-medium text-ink-soft border-b border-line">
              <tr>
                <th className="py-2.5 px-4 font-medium">Category</th>
                <th className="py-2.5 px-4 font-medium tabular-nums">Found / Expected</th>
                <th className="py-2.5 px-4 font-medium tabular-nums">Recall</th>
                <th className="py-2.5 px-4 font-medium tabular-nums">Precision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e9ee]">
              <tr>
                <td className="py-3 px-4 font-semibold text-ink">Decisions</td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">
                  {summary.decisions.correct} / {summary.decisions.expected}
                </td>
                <td className="py-3 px-4 font-medium text-ink tabular-nums">
                  {summary.decisions.recall}%
                </td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">
                  {summary.decisions.precision}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-ink">New tasks</td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">
                  {summary.tasks.correct} / {summary.tasks.expected}
                </td>
                <td className="py-3 px-4 font-medium text-ink tabular-nums">
                  {summary.tasks.recall}%
                </td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">
                  {summary.tasks.precision}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-ink">Task updates</td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">
                  {summary.task_updates.correct} / {summary.task_updates.expected}
                </td>
                <td className="py-3 px-4 font-medium text-ink tabular-nums">
                  {summary.task_updates.recall}%
                </td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">
                  {summary.task_updates.precision}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-ink">Conflicts</td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">
                  {summary.conflicts.correct} / {summary.conflicts.expected}
                </td>
                <td className="py-3 px-4 font-medium text-ink tabular-nums">
                  {summary.conflicts.recall}%
                </td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">
                  {summary.conflicts.precision}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-ink">Quotes verified verbatim</td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">—</td>
                <td className="py-3 px-4 font-medium text-green tabular-nums">
                  {summary.evidence_validity}%
                </td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">—</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-ink">Owners not guessed (unassigned)</td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">—</td>
                <td className="py-3 px-4 font-medium text-green tabular-nums">
                  {summary.no_guess_rate}%
                </td>
                <td className="py-3 px-4 text-ink-soft tabular-nums">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-ink-faint text-[14px]">
          {loading ? 'Loading evaluation metrics...' : 'No evaluation data recorded. Click "Run evaluation" above.'}
        </div>
      )}

      {/* Per-Meeting Breakdown */}
      {evalData?.meetings && (
        <section className="space-y-4">
          <h2 className="text-[17px] font-semibold text-ink">
            Per-meeting results
          </h2>

          <div className="border-t border-b border-line divide-y divide-[#e7e9ee]">
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
                <div key={m.meeting_id} className="py-3 space-y-2">
                  <div
                    onClick={() => setExpandedMeeting(isExpanded ? null : m.meeting_id)}
                    className="flex flex-col md:flex-row md:items-baseline justify-between gap-3 cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink text-[15px] group-hover:text-accent-text">
                          {m.title}
                        </span>
                        <span className="text-[12px] text-ink-faint tabular-nums">
                          ({m.meeting_date})
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[13px] text-ink-soft mt-1 flex-wrap tabular-nums">
                        <span>Decisions: {m.decisions.correct}/{m.decisions.expected}</span>
                        <span>·</span>
                        <span>Tasks: {m.tasks.correct}/{m.tasks.expected}</span>
                        <span>·</span>
                        <span>Updates: {m.task_updates.correct}/{m.task_updates.expected}</span>
                        <span>·</span>
                        <span>Conflicts: {m.conflicts.correct}/{m.conflicts.expected}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!hasMissed && !hasExtra ? (
                        <span className="text-[12px] font-medium text-green bg-green-tint px-2 py-0.5 rounded-[4px] border border-green/30">
                          100% Match
                        </span>
                      ) : (
                        <span className="text-[12px] font-medium text-amber bg-amber-tint px-2 py-0.5 rounded-[4px] border border-amber/30">
                          Discrepancies
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-ink-faint" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-ink-faint" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 rounded-[6px] bg-fill border border-line space-y-3 text-[13px] mt-2">
                      {/* Missed items formatted as sentences */}
                      <div>
                        <div className="font-semibold text-red text-[12px] mb-1">
                          Missed items
                        </div>
                        {!hasMissed ? (
                          <p className="text-ink-soft italic">None. All expected items were captured.</p>
                        ) : (
                          <ul className="list-disc pl-5 space-y-1 text-ink">
                            {m.decisions?.missed?.map((d, i) => (
                              <li key={i}>
                                Expected decision on {d.topic} with value "{d.value}".
                              </li>
                            ))}
                            {m.tasks?.missed?.map((t, i) => (
                              <li key={i}>
                                Expected task "{t.title}" assigned to {t.owner || 'Unassigned'}.
                              </li>
                            ))}
                            {m.task_updates?.missed?.map((u, i) => (
                              <li key={i}>
                                Expected update to {u.title_keyword}: status {u.new_status}, deadline {u.new_deadline}.
                              </li>
                            ))}
                            {m.conflicts?.missed?.map((c, i) => (
                              <li key={i}>
                                Expected {c.type}: {c.description}.
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Extra items formatted as sentences */}
                      <div>
                        <div className="font-semibold text-amber text-[12px] mb-1">
                          Extra unmapped items
                        </div>
                        {!hasExtra ? (
                          <p className="text-ink-soft italic">None. No extra items were found.</p>
                        ) : (
                          <ul className="list-disc pl-5 space-y-1 text-ink">
                            {m.tasks?.extra?.map((t, i) => (
                              <li key={i}>
                                Extracted task "{t.title}" for {t.owner || 'Unassigned'}.
                              </li>
                            ))}
                            {m.decisions?.extra?.map((d, i) => (
                              <li key={i}>
                                Extracted decision on {d.topic} with value "{d.value}".
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
