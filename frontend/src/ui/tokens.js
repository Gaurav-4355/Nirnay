// Design tokens and helpers for Nirnay's marked-up record system

export const TOKENS = {
  surface: '#ffffff',
  subtle: '#f7f8fa',
  hairline: '#e7e9ee',
  hairlineStrong: '#cdd1da',
  ink: '#0f1222',
  inkSoft: '#5e6477',
  inkFaint: '#8a90a2',
  penBlue: '#1e35c7',
  penBlueHover: '#172aa3',
  penBlueTint: '#eef1fd',
  redPen: '#d0272d',
  redPenTint: '#fdf1f1',
  stampGreen: '#14795a',
  stampGreenTint: '#eef8f3',
  pencilAmber: '#b26b00',
  pencilAmberTint: '#fff6e5',
  highlighter: '#ffe066',
};

export const STAMP_STYLES = {
  // Task & Decision statuses
  active: 'bg-[#eef8f3] text-[#14795a] border-[#14795a]/30',
  done: 'bg-[#eef8f3] text-[#14795a] border-[#14795a]/30',
  pending: 'bg-[#f7f8fa] text-[#5e6477] border-[#e7e9ee]',
  blocked: 'bg-[#fdf1f1] text-[#d0272d] border-[#d0272d]/30',
  overdue: 'bg-[#fdf1f1] text-[#d0272d] border-[#d0272d]/30',
  superseded: 'bg-[#f7f8fa] text-[#8a90a2] border-[#e7e9ee] line-through',

  // Conflict resolutions
  kept_new: 'bg-[#eef8f3] text-[#14795a] border-[#14795a]/30',
  kept_old: 'bg-[#fff6e5] text-[#b26b00] border-[#b26b00]/30',
  acknowledged: 'bg-[#f7f8fa] text-[#5e6477] border-[#e7e9ee]',
  unresolved: 'bg-[#fdf1f1] text-[#d0272d] border-[#d0272d]/30',

  // Needs input / assignments
  unassigned: 'bg-[#fff6e5] text-[#b26b00] border-[#b26b00]/30',
  needs_clarification: 'bg-[#fff6e5] text-[#b26b00] border-[#b26b00]/30',
  clarification: 'bg-[#fff6e5] text-[#b26b00] border-[#b26b00]/30',
};

// 6 restrained ink tones for avatar rings based on name hash
const AVATAR_RINGS = [
  'border-[#1e35c7] text-[#1e35c7]', // pen-blue
  'border-[#5e6477] text-[#0f1222]', // ink-soft
  'border-[#14795a] text-[#14795a]', // stamp-green
  'border-[#b26b00] text-[#b26b00]', // pencil-amber
  'border-[#795290] text-[#795290]', // subdued plum
  'border-[#3d5a80] text-[#3d5a80]', // slate ink
];

export function getAvatarStyle(name) {
  if (!name) return 'border-[#cdd1da] text-[#5e6477]';
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
