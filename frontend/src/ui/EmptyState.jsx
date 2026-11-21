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
    <div className={`p-12 text-center rounded-[10px] border border-[#e7e9ee] bg-white max-w-lg mx-auto my-8 ${className}`}>
      {Icon && (
        <div className="w-10 h-10 rounded-[6px] bg-[#f7f8fa] border border-[#e7e9ee] flex items-center justify-center mx-auto text-[#1e35c7] mb-3">
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-[17px] font-semibold text-[#0f1222]">{title}</h3>
      {description && (
        <p className="text-[13px] text-[#5e6477] mt-1.5 leading-relaxed max-w-md mx-auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4">
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-[6px] text-[13px] font-semibold bg-[#1e35c7] hover:bg-[#172aa3] text-white transition-colors"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
