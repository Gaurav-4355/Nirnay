import React from 'react';
import {
  FileText,
  Brain,
  History,
  AlertTriangle,
  ShieldCheck,
  Kanban,
  X,
  Compass,
} from 'lucide-react';

export default function HowItWorksModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const flowSteps = [
    {
      icon: FileText,
      step: '1',
      title: 'Hinglish dialogue ingestion',
      desc: 'Takes raw meeting dialogues in Hindi, English or Hinglish with timestamps and speaker labels.',
    },
    {
      icon: Brain,
      step: '2',
      title: 'LLM extraction & verbatim quotes',
      desc: 'Groq extracts decisions and tasks. Verbatim quotes are verified against transcript character-for-character.',
    },
    {
      icon: History,
      step: '3',
      title: 'Cross-meeting memory check',
      desc: 'Injects active decisions and open tasks into prompt. Reuses topic labels and tracks deadline or status changes.',
    },
    {
      icon: AlertTriangle,
      step: '4',
      title: 'Deterministic conflict radar',
      desc: 'Detects decision overrides (499->599), workload spikes (3+ tasks in 7 days), and dependency timeline clashes.',
    },
    {
      icon: ShieldCheck,
      step: '5',
      title: 'Human outbox confirmation',
      desc: 'Nothing leaves the system without approval. Pending cards, reminders, and weekly digests queue for human sign-off.',
    },
    {
      icon: Kanban,
      step: '6',
      title: 'Execution, trackers & reminders',
      desc: 'Dispatches cards to Trello, automates due-soon & blocked reminders, and powers grounded AI queries.',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/15 z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl bg-surface border border-line rounded-[10px] shadow-elevated overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[6px] bg-accent flex items-center justify-center text-white">
              <Compass className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-ink">
                How Nirnay works
              </h3>
              <p className="text-[13px] text-ink-soft">
                Meeting-to-execution pipeline with human-in-the-loop control.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[6px] text-ink-faint hover:text-ink hover:bg-fill"
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
                  className="p-4 rounded-[8px] bg-surface border border-line space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-fill border border-line flex items-center justify-center text-[11px] font-bold text-ink tabular-nums">
                      {fs.step}
                    </span>
                    <Icon className="w-4 h-4 text-accent-text" strokeWidth={1.5} />
                    <span className="text-[14px] font-semibold text-ink">
                      {fs.title}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-soft leading-relaxed pl-7">
                    {fs.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-fill flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] text-[13px] font-medium bg-surface hover:bg-fill text-ink border border-line transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
