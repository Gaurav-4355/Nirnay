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
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 pb-4 border-b border-[#e7e9ee]">
        <div>
          <h1 className="text-[30px] font-bold text-[#0f1222] tracking-[-0.02em] leading-tight">
            How accurate is Nirnay?
          </h1>
          <p className="text-[15px] text-[#5e6477] mt-1">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium bg-white hover:bg-[#f7f8fa] text-[#0f1222] border border-[#e7e9ee] transition-colors"
              title="Save current results as default snapshot"
            >
              <FileDown className="w-3.5 h-3.5 text-[#5e6477]" />
              <span>{exporting ? 'Saving...' : 'Export snapshot'}</span>
            </button>
          )}

          <button
            onClick={handleRunEvaluation}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] text-[13px] font-semibold bg-[#1e35c7] hover:bg-[#172aa3] text-white disabled:opacity-40 transition-colors"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Evaluating...' : 'Run evaluation'}</span>
          </button>
        </div>
      </div>

      {/* Progress Box while running */}
      {isRunning && (
        <div className="p-4 rounded-[6px] bg-[#f7f8fa] border border-[#1e35c7] text-[13px] text-[#0f1222] flex items-center gap-3">
          <RotateCw className="w-4 h-4 text-[#1e35c7] animate-spin shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-[#0f1222]">Evaluation in progress:</span>{' '}
            <span className="text-[#5e6477] tabular-nums">{evalJob.progress || 'Processing seed meetings...'}</span>
          </div>
        </div>
      )}

      {/* Visible Note: Hand-annotated demo meetings */}
      <div className="p-3.5 rounded-[6px] bg-[#f7f8fa] border border-[#e7e9ee] text-[13px] text-[#5e6477] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#5e6477] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-[#0f1222]">Note on test set:</strong> This evaluation measures the pipeline against 3 demo meetings we authored ourselves with hand-annotated expected decisions, tasks, deadline changes, and conflicts. The test runs in an isolated in-memory SQLite sandbox with live LLM extraction.
        </div>
      </div>

      {/* Clean Tabular View */}
      {summary ? (
        <div className="border border-[#e7e9ee] rounded-[8px] overflow-hidden bg-white">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-[#f7f8fa] text-[12px] font-medium text-[#5e6477] border-b border-[#e7e9ee]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Category</th>
                <th className="py-2.5 px-4 font-medium tabular-nums">Found / Expected</th>
                <th className="py-2.5 px-4 font-medium tabular-nums">Recall</th>
                <th className="py-2.5 px-4 font-medium tabular-nums">Precision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e9ee]">
              <tr>
                <td className="py-3 px-4 font-semibold text-[#0f1222]">Decisions</td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">
                  {summary.decisions.correct} / {summary.decisions.expected}
                </td>
                <td className="py-3 px-4 font-medium text-[#0f1222] tabular-nums">
                  {summary.decisions.recall}%
                </td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">
                  {summary.decisions.precision}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#0f1222]">New tasks</td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">
                  {summary.tasks.correct} / {summary.tasks.expected}
                </td>
                <td className="py-3 px-4 font-medium text-[#0f1222] tabular-nums">
                  {summary.tasks.recall}%
                </td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">
                  {summary.tasks.precision}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#0f1222]">Task updates</td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">
                  {summary.task_updates.correct} / {summary.task_updates.expected}
                </td>
                <td className="py-3 px-4 font-medium text-[#0f1222] tabular-nums">
                  {summary.task_updates.recall}%
                </td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">
                  {summary.task_updates.precision}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#0f1222]">Conflicts</td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">
                  {summary.conflicts.correct} / {summary.conflicts.expected}
                </td>
                <td className="py-3 px-4 font-medium text-[#0f1222] tabular-nums">
                  {summary.conflicts.recall}%
                </td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">
                  {summary.conflicts.precision}%
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#0f1222]">Quotes verified verbatim</td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">—</td>
                <td className="py-3 px-4 font-medium text-[#14795a] tabular-nums">
                  {summary.evidence_validity}%
                </td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">—</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-[#0f1222]">Owners not guessed (unassigned)</td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">—</td>
                <td className="py-3 px-4 font-medium text-[#14795a] tabular-nums">
                  {summary.no_guess_rate}%
                </td>
                <td className="py-3 px-4 text-[#5e6477] tabular-nums">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-[#8a90a2] text-[14px]">
          {loading ? 'Loading evaluation metrics...' : 'No evaluation data recorded. Click "Run evaluation" above.'}
        </div>
      )}

      {/* Per-Meeting Breakdown */}
      {evalData?.meetings && (
        <section className="space-y-4">
          <h2 className="text-[17px] font-semibold text-[#0f1222]">
            Per-meeting results
          </h2>

          <div className="border-t border-b border-[#e7e9ee] divide-y divide-[#e7e9ee]">
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
                        <span className="font-semibold text-[#0f1222] text-[15px] group-hover:text-[#1e35c7]">
                          {m.title}
                        </span>
                        <span className="text-[12px] text-[#8a90a2] tabular-nums">
                          ({m.meeting_date})
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[13px] text-[#5e6477] mt-1 flex-wrap tabular-nums">
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
                        <span className="text-[12px] font-medium text-[#14795a] bg-[#eef8f3] px-2 py-0.5 rounded-[4px] border border-[#14795a]/30">
                          100% Match
                        </span>
                      ) : (
                        <span className="text-[12px] font-medium text-[#b26b00] bg-[#fff6e5] px-2 py-0.5 rounded-[4px] border border-[#b26b00]/30">
                          Discrepancies
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#8a90a2]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#8a90a2]" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 rounded-[6px] bg-[#f7f8fa] border border-[#e7e9ee] space-y-3 text-[13px] mt-2">
                      {/* Missed items formatted as sentences */}
                      <div>
                        <div className="font-semibold text-[#d0272d] text-[12px] mb-1">
                          Missed items
                        </div>
                        {!hasMissed ? (
                          <p className="text-[#5e6477] italic">None. All expected items were captured.</p>
                        ) : (
                          <ul className="list-disc pl-5 space-y-1 text-[#0f1222]">
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
                        <div className="font-semibold text-[#b26b00] text-[12px] mb-1">
                          Extra unmapped items
                        </div>
                        {!hasExtra ? (
                          <p className="text-[#5e6477] italic">None. No extra items were found.</p>
                        ) : (
                          <ul className="list-disc pl-5 space-y-1 text-[#0f1222]">
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
