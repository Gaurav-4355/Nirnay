import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Play,
  RotateCw,
  X,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Clock,
  RotateCcw,
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
      title: '1. Wake Up Backend & Check Model',
      description: 'Ping the live backend API server to measure latency and verify the Groq LLM model.',
      script: 'Our backend is running live with Groq LLM and SQLite persistence. Let’s verify health and response time.',
      actionLabel: 'Ping Backend Health',
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
      title: '2. Reset Demo Database',
      description: 'Clear all previous meetings, decisions, tasks, and conflicts to start with a clean slate.',
      script: 'Clearing our workspace so you can witness Nirnay extract everything from scratch in real time.',
      actionLabel: 'Reset All Data',
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
      title: '3. Analyze Meeting 1: Launch Timeline',
      description: 'Analyze transcript with Hinglish parsing, relative dates, and extract decisions & tasks without saving.',
      script: 'Notice how Nirnay understands Hinglish like "5 Dec tak" and extracts decisions with verbatim evidence quotes.',
      actionLabel: 'Analyze Meeting 1',
      action: async () => {
        if (onNavigate) onNavigate('new_meeting');
        // Fetch demo meeting 1
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
      script: 'The human confirms the proposal. Tasks and decisions are saved, and cards are queued in the Outbox for review.',
      actionLabel: 'Confirm & Save Meeting 1',
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
      title: '5. Analyze Meeting 2: Pricing Revision',
      description: 'Notice automatic detection of the pricing change (Rs 499 -> Rs 599) and completed tasks.',
      script: 'Watch cross-meeting memory at work: Nirnay flags the pricing conflict and updates earlier tasks to done.',
      actionLabel: 'Analyze Meeting 2',
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
      actionLabel: 'Confirm Meeting 2',
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
      title: '7. Analyze Meeting 3: Triple Conflict',
      description: 'Simultaneously detect launch date override, Priya’s workload overload, and Karan’s dependency clash.',
      script: 'All 3 conflict types detected: launch postponed to 5 Feb, Priya overloaded with 5 tasks, and Karan’s dependency at risk.',
      actionLabel: 'Analyze Meeting 3',
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
      title: '8. Explore Outbox, Brief & Ask Nirnay',
      description: 'Tour the human confirmation gateway, executive briefing printable pack, and grounded AI chat.',
      script: 'Finally, explore human approval in Outbox, printable Meeting Brief, and Ask Nirnay with verbatim citations.',
      actionLabel: 'Go to Dashboard & Tour Views',
      action: async () => {
        // Auto-confirm M3 if we have it
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
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-slate-950 border-l border-slate-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-lg shadow-indigo-900/30">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Guided Demo Mode
            </h3>
            <p className="text-[11px] text-slate-400">Step-by-step walkthrough for judges & demos</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
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
              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                isDone
                  ? 'bg-slate-900/40 border-emerald-900/50'
                  : isActive
                  ? 'bg-slate-900/90 border-indigo-500/80 ring-1 ring-indigo-500/30'
                  : 'bg-slate-900/20 border-slate-800/80 opacity-70'
              }`}
            >
              {/* Step Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 text-[10px] font-bold flex items-center justify-center text-slate-400 shrink-0">
                      {step.id + 1}
                    </span>
                  )}
                  <h4 className="text-xs font-bold text-white">{step.title}</h4>
                </div>
                {stepData[step.id] && typeof stepData[step.id] === 'string' && (
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                    {stepData[step.id]}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {step.description}
              </p>

              {/* Presenter Cue */}
              <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-200/90 leading-relaxed">
                <strong className="text-amber-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                  What to say:
                </strong>
                "{step.script}"
              </div>

              {/* Action Button */}
              <div className="pt-1">
                <button
                  onClick={() => handleExecuteStep(step)}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950'
                  }`}
                >
                  <Play className={`w-3 h-3 fill-current ${isLoading ? 'animate-spin' : ''}`} />
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
