// Design tokens and helpers for Nirnay's marked-up record system

export const STAMP_STYLES = {
  // Task & Decision statuses
  active: 'bg-green-tint text-green border-green/30',
  done: 'bg-green-tint text-green border-green/30',
  pending: 'bg-fill text-ink-soft border-line',
  blocked: 'bg-red-tint text-red border-red/30',
  overdue: 'bg-red-tint text-red border-red/30',
  superseded: 'bg-fill text-ink-faint border-line line-through',

  // Conflict resolutions
  kept_new: 'bg-green-tint text-green border-green/30',
  kept_old: 'bg-amber-tint text-amber border-amber/30',
  acknowledged: 'bg-fill text-ink-soft border-line',
  unresolved: 'bg-red-tint text-red border-red/30',

  // Needs input / assignments
  unassigned: 'bg-amber-tint text-amber border-amber/30',
  needs_clarification: 'bg-amber-tint text-amber border-amber/30',
  clarification: 'bg-amber-tint text-amber border-amber/30',
};

// Restrained ink tones for avatar rings using CSS tokens
const AVATAR_RINGS = [
  'border-accent text-accent-text',
  'border-ink-soft text-ink',
  'border-green text-green',
  'border-amber text-amber',
  'border-line-strong text-ink-soft',
  'border-red text-red',
];

export function getAvatarStyle(name) {
  if (!name) return 'border-line-strong text-ink-soft';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_RINGS.length;
  return AVATAR_RINGS[idx];
}

export function formatTopic(topic) {
  if (!topic) return 'General policy';
  return topic
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
