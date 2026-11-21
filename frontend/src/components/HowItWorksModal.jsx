import React from 'react';
import {
  Sparkles,
  X,
  FileText,
  Brain,
  History,
  AlertTriangle,
  Send,
  Kanban,
  Bell,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function HowItWorksModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const flowSteps = [
    {
      icon: FileText,
      step: '1',
      title: 'Hinglish Transcript Ingestion',
      desc: 'Takes raw meeting dialogues in Hindi, English or Hinglish with timestamps and speaker labels.',
      color: 'text-indigo-400 bg-indigo-950/60 border-indigo-800',
    },
    {
      icon: Brain,
      step: '2',
      title: 'LLM Extraction & Quote Match',
      desc: 'Groq LLaMA extracts decisions and tasks. Verbatim quotes are verified against transcript character-for-character.',
      color: 'text-purple-400 bg-purple-950/60 border-purple-800',
    },
    {
      icon: History,
      step: '3',
      title: 'Cross-Meeting Memory Check',
      desc: 'Injects active decisions and open tasks into prompt. Reuses topic labels and tracks deadline or status changes.',
      color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800',
    },
    {
      icon: AlertTriangle,
      step: '4',
      title: 'Deterministic Conflict Radar',
      desc: 'Detects decision overrides (499->599), workload spikes (3+ tasks in 7 days), and dependency timeline clashes.',
      color: 'text-rose-400 bg-rose-950/60 border-rose-800',
    },
    {
      icon: ShieldCheck,
      step: '5',
      title: 'Human Outbox Confirmation',
      desc: 'Nothing leaves the system without approval. Pending cards, reminders, and weekly digests queue for human sign-off.',
      color: 'text-amber-400 bg-amber-950/60 border-amber-800',
    },
    {
      icon: Kanban,
      step: '6',
      title: 'Execution, Trackers & Reminders',
      desc: 'Dispatches cards to Trello, automates due-soon & blocked reminders, and powers grounded AI queries.',
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-lg shadow-indigo-950">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                How Nirnay Works
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                  Architecture
                </span>
              </h3>
              <p className="text-xs text-slate-400">Meeting-to-Execution pipeline with verifiable human-in-the-loop control.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flowSteps.map((fs, idx) => {
              const Icon = fs.icon;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs ${fs.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      STEP {fs.step}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{fs.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{fs.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/40 text-xs text-slate-300 space-y-1">
            <strong className="text-indigo-300 block font-semibold">Core Principle: Zero Hallucination & Verifiable Quotes</strong>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Nirnay never guesses task owners or invents decisions. Every extracted commitment is character-matched against the transcript, and every outward notification requires human approval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
