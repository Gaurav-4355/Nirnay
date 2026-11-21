import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function ErrorAlert({ message, onRetry, className = '' }) {
  if (!message) return null;

  return (
    <div
      className={`p-4 rounded-[6px] bg-red-tint border border-red/30 text-red text-[13px] flex items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-2.5 py-1 rounded-[4px] text-[12px] font-semibold bg-red text-white hover:opacity-90 flex items-center gap-1 transition-opacity shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
