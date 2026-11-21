import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorAlert({ message, onRetry, className = '' }) {
  return (
    <div className={`p-4 rounded-xl border border-red-200 bg-red-50 text-red-900 flex items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-red-950">Unable to load data</p>
          <p className="text-xs text-red-800 mt-0.5">{message || 'An error occurred while fetching information.'}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-red-200 text-red-800 hover:bg-red-100 transition-colors shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
