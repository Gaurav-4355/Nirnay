import React from 'react';
import { getAvatarStyle } from './tokens';

/**
 * Avatar: Initials, white background with a 1px ring and ink text;
 * tone picked from 6 restrained inks by name hash.
 */
export default function Avatar({ name, size = 'sm' }) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  const ringStyle = getAvatarStyle(name);
  const sizeClass = size === 'xs' ? 'w-5 h-5 text-[10px]' : size === 'md' ? 'w-8 h-8 text-[13px]' : 'w-6 h-6 text-[11px]';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-white border font-medium tabular-nums select-none shrink-0 ${ringStyle} ${sizeClass}`}
      title={name}
    >
      {initials}
    </span>
  );
}
