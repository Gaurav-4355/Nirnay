import React, { useState } from 'react';
import {
  CheckCircle2,
  Play,
  X,
  Zap,
} from 'lucide-react';

export default function GuidedDemoDrawer({ isOpen, onClose, onNavigate, showToast, onRefreshAll }) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [loadingStep, setLoadingStep] = useState(null);
  const [stepData, setStepData] = useState({});

  if (!isOpen) return null;

  const steps = [
    {
      id: 0,
      title: '1. Ping backend health',
      description: 'Ping the live backend API server to measure latency and verify the Groq LLM model.',
      script: 'Our backend is running live with Groq LLM and SQLite persistence. Let’s verify health and response time.',
      actionLabel: 'Ping backend health',
      action: async () => {
        const start = performance.now();
        const res = await fetch('/api/health');
        const elapsed = Math.round(performance.now() - start);
        if (res.ok) {
          const data = await res.json();
          setStepData((prev) => ({ ...prev, [0]: `${elapsed}ms (${data.model})` }));
          return true;
        }
        return false;
      },
    },
    {
      id: 1,
      title: '2. Reset demo database',
      description: 'Clear all previous meetings, decisions, tasks, and conflicts to start with a clean slate.',
      script: 'Clearing our workspace so you can witness Nirnay extract everything from scratch in real time.',
      actionLabel: 'Reset all data',
      action: async () => {
        const res = await fetch('/api/reset', { method: 'POST' });
        if (res.ok) {
          if (onRefreshAll) onRefreshAll();
          if (onNavigate) onNavigate('new_meeting');
          return true;
        }
        return false;
      },
    },
    {
      id: 2,
      title: '3. Read Meeting 1: Launch timeline',
      description: 'Analyze transcript with Hinglish parsing, relative dates, and extract decisions & tasks.',
      script: 'Notice how Nirnay understands Hinglish like "5 Dec tak" and extracts decisions with verbatim evidence quotes.',
      actionLabel: 'Read Meeting 1',
      action: async () => {
        if (onNavigate) onNavigate('new_meeting');
        const resDemo = await fetch('/api/seed/demo-meetings');
        const demos = await resDemo.json();
        const m1 = demos[0];
        if (!m1) return false;

        const res = await fetch('/api/meetings/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: m1.title,
            meeting_date: m1.meeting_date,
            transcript: m1.transcript,
          }),
        });

        if (res.ok) {
          const proposal = await res.json();
          setStepData((prev) => ({ ...prev, [2]: proposal }));
          return true;
        }
        return false;
      },
    },
    {
      id: 3,
      title: '4. Confirm Meeting 1',
      description: 'Save proposal into database, establish memory, and auto-queue tracker cards in Outbox.',
      script: 'The human approves the proposal. Tasks and decisions are saved, and cards are queued in the Outbox for review.',
      actionLabel: 'Approve & save Meeting 1',
      action: async () => {
        let proposal = stepData[2];
        if (!proposal) {
          const resDemo = await fetch('/api/seed/demo-meetings');
          const demos = await resDemo.json();
          const m1 = demos[0];
          const ana = await fetch('/api/meetings/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m1),
          });
          proposal = await ana.json();
        }

        const res = await fetch('/api/meetings/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposal),
        });

        if (res.ok) {
          if (onRefreshAll) onRefreshAll();
          if (onNavigate) onNavigate('tasks');
          return true;
        }
        return false;
      },
    },
    {
      id: 4,
      title: '5. Read Meeting 2: Pricing revision',
      description: 'Automatic detection of the pricing change (Rs 499 -> Rs 599) and completed tasks.',
      script: 'Watch cross-meeting memory at work: Nirnay flags the pricing conflict and updates earlier tasks to done.',
      actionLabel: 'Read Meeting 2',
      action: async () => {
        if (onNavigate) onNavigate('new_meeting');
        const resDemo = await fetch('/api/seed/demo-meetings');
        const demos = await resDemo.json();
        const m2 = demos[1];

        const res = await fetch('/api/meetings/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: m2.title,
            meeting_date: m2.meeting_date,
            transcript: m2.transcript,
          }),
        });

        if (res.ok) {
          const proposal = await res.json();
          setStepData((prev) => ({ ...prev, [4]: proposal }));
          return true;
        }
        return false;
      },
    },
    {
      id: 5,
      title: '6. Confirm Meeting 2',
      description: 'Resolve decision conflict with "kept_new" and supersede the old pricing.',
      script: 'Meeting 2 confirmed: Rs 599 is now active, Rs 499 is superseded, and landing page tasks are marked done.',
      actionLabel: 'Approve Meeting 2',
      action: async () => {
        let proposal = stepData[4];
        if (!proposal) {
          const resDemo = await fetch('/api/seed/demo-meetings');
          const demos = await resDemo.json();
          const m2 = demos[1];
          const ana = await fetch('/api/meetings/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m2),
          });
          proposal = await ana.json();
        }

        proposal.conflict_resolutions = [
          { conflict_index: 0, resolution: 'kept_new', topic: 'pricing' },
        ];

        const res = await fetch('/api/meetings/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposal),
        });

        if (res.ok) {
          if (onRefreshAll) onRefreshAll();
          if (onNavigate) onNavigate('decisions');
          return true;
        }
        return false;
      },
    },
    {
      id: 6,
      title: '7. Read Meeting 3: Triple conflict',
      description: 'Simultaneously detect launch date override, Priya’s workload overload, and Karan’s dependency clash.',
      script: 'All 3 conflict types detected: launch postponed to 5 Feb, Priya overloaded with 5 tasks, and Karan’s dependency at risk.',
      actionLabel: 'Read Meeting 3',
      action: async () => {
        if (onNavigate) onNavigate('new_meeting');
        const resDemo = await fetch('/api/seed/demo-meetings');
        const demos = await resDemo.json();
        const m3 = demos[2];

        const res = await fetch('/api/meetings/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: m3.title,
            meeting_date: m3.meeting_date,
            transcript: m3.transcript,
          }),
        });

        if (res.ok) {
          const proposal = await res.json();
          setStepData((prev) => ({ ...prev, [6]: proposal }));
          return true;
        }
        return false;
      },
    },
    {
      id: 7,
      title: '8. Explore memory & summaries',
      description: 'Tour the human confirmation gateway, executive briefing printable pack, and grounded AI chat.',
      script: 'Finally, explore human approval in Waiting for approval, printable Meeting Brief, and Ask Nirnay.',
      actionLabel: 'Go to Today & tour views',
      action: async () => {
        const proposal = stepData[6];
        if (proposal) {
          await fetch('/api/meetings/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...proposal,
              conflict_resolutions: [
                { conflict_index: 0, resolution: 'kept_new' },
                { conflict_index: 1, resolution: 'acknowledged' },
                { conflict_index: 2, resolution: 'acknowledged' },
              ],
            }),
          });
        }
        if (onRefreshAll) onRefreshAll();
        if (onNavigate) onNavigate('dashboard');
        return true;
      },
    },
  ];

  const handleExecuteStep = async (step) => {
    setLoadingStep(step.id);
    try {
      const ok = await step.action();
      if (ok) {
        setCompletedSteps((prev) => new Set([...prev, step.id]));
        if (showToast) showToast(`Completed: ${step.title}`, 'success');
        if (step.id < steps.length - 1) {
          setActiveStep(step.id + 1);
        }
      } else {
        if (showToast) showToast(`Step failed: ${step.title}`, 'error');
      }
    } catch (e) {
      if (showToast) showToast(`Error executing step: ${e.message}`, 'error');
    } finally {
      setLoadingStep(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white border-l border-[#e7e9ee] shadow-elevated z-50 flex flex-col select-none">
      {/* Header */}
      <div className="p-5 border-b border-[#e7e9ee] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[6px] bg-[#1e35c7] flex items-center justify-center text-white">
            <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#0f1222]">
              Guided demo
            </h3>
            <p className="text-[12px] text-[#5e6477]">Step-by-step walkthrough for live testing</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-[6px] text-[#8a90a2] hover:text-[#0f1222] hover:bg-[#f7f8fa]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {steps.map((step) => {
          const isDone = completedSteps.has(step.id);
          const isActive = activeStep === step.id;
          const isLoading = loadingStep === step.id;

          return (
            <div
              key={step.id}
              className={`p-4 rounded-[8px] border transition-colors space-y-2.5 ${
                isDone
                  ? 'bg-[#eef8f3]/40 border-[#14795a]/30'
                  : isActive
                  ? 'bg-[#f7f8fa] border-[#1e35c7]'
                  : 'bg-white border-[#e7e9ee]'
              }`}
            >
              {/* Step Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-[#14795a] shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-[#cdd1da] text-[11px] font-medium flex items-center justify-center text-[#5e6477] shrink-0 tabular-nums">
                      {step.id + 1}
                    </span>
                  )}
                  <h4 className="text-[14px] font-semibold text-[#0f1222]">{step.title}</h4>
                </div>
                {stepData[step.id] && typeof stepData[step.id] === 'string' && (
                  <span className="text-[11px] text-[#14795a] font-medium tabular-nums">
                    {stepData[step.id]}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-[13px] text-[#5e6477] leading-relaxed">
                {step.description}
              </p>

              {/* Presenter Cue */}
              <div className="p-2.5 rounded-[6px] bg-white border border-[#e7e9ee] text-[13px] leading-relaxed font-serif italic text-[#0f1222]">
                <strong className="text-[11px] not-italic font-sans font-medium text-[#8a90a2] block mb-0.5">
                  What to say:
                </strong>
                "{step.script}"
              </div>

              {/* Action Button */}
              <div className="pt-1">
                <button
                  onClick={() => handleExecuteStep(step)}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-[6px] text-[13px] font-semibold transition-colors ${
                    isDone
                      ? 'bg-white hover:bg-[#f7f8fa] text-[#0f1222] border border-[#e7e9ee]'
                      : 'bg-[#1e35c7] hover:bg-[#172aa3] text-white'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Executing...' : isDone ? `Re-run: ${step.actionLabel}` : step.actionLabel}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
