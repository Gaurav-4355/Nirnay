import React from 'react';

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  className = '',
}) {
  return (
    <div className={`p-12 text-center rounded-[10px] border border-line bg-surface max-w-lg mx-auto my-8 ${className}`}>
      {Icon && (
        <div className="w-10 h-10 rounded-[6px] bg-fill border border-line flex items-center justify-center mx-auto text-accent-text mb-3">
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      {description && (
        <p className="text-[13px] text-ink-soft mt-1.5 leading-relaxed max-w-md mx-auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4">
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-[6px] text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
