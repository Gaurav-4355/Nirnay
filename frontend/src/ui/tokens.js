// Design tokens and shared styling utilities for Nirnay

export const STAMP_STYLES = {
  // Decision & Task statuses
  active: 'border-emerald-600/40 text-emerald-800 bg-emerald-50/80',
  done: 'border-emerald-700/50 text-emerald-800 bg-emerald-50/80',
  pending: 'border-stone-400 text-stone-700 bg-stone-100',
  blocked: 'border-red-600/40 text-red-800 bg-red-50/80',
  overdue: 'border-red-700 text-red-900 bg-red-100',
  superseded: 'border-stone-300 text-stone-500 bg-stone-100 line-through',

  // Conflict resolutions
  kept_new: 'border-emerald-700 text-emerald-800 bg-emerald-50',
  kept_old: 'border-amber-700 text-amber-800 bg-amber-50',
  acknowledged: 'border-stone-600 text-stone-800 bg-stone-100',
  unresolved: 'border-red-700/60 text-red-800 bg-red-50/60',

  // Actions / General
  unassigned: 'border-amber-600 text-amber-800 bg-amber-50',
  clarification: 'border-amber-600 text-amber-800 bg-amber-50',
};

export const TOPIC_LABELS = {
  launch_date: 'Launch date',
  pricing: 'Pricing model',
  tech_stack: 'Technology stack',
  qa_timeline: 'Quality assurance timeline',
};

export function formatTopic(topic) {
  if (!topic) return 'General policy';
  if (TOPIC_LABELS[topic]) return TOPIC_LABELS[topic];
  return topic
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
