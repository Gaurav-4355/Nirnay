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
    <div className={`p-12 text-center rounded-xl border border-stone-200 bg-white shadow-sm max-w-lg mx-auto my-8 ${className}`}>
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-600 mb-3">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      {description && (
        <p className="text-xs text-stone-600 mt-1.5 leading-relaxed max-w-md mx-auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4">
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-900 hover:bg-stone-800 text-white shadow-sm transition-all"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
