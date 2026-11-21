import React from 'react';

export default function LoadingSkeleton({ rows = 5, type = 'ledger', className = '' }) {
  if (type === 'cards') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-stone-200 bg-white space-y-3 animate-pulse">
            <div className="h-4 bg-stone-200 rounded w-1/3"></div>
            <div className="space-y-2 pt-2">
              <div className="h-16 bg-stone-100 rounded-lg"></div>
              <div className="h-16 bg-stone-100 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`border border-stone-200 rounded-xl bg-white overflow-hidden shadow-sm ${className}`}>
      <div className="h-10 bg-stone-50 border-b border-stone-200 px-6 flex items-center">
        <div className="h-3 bg-stone-200 rounded w-48 animate-pulse"></div>
      </div>
      <div className="divide-y divide-stone-100">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center justify-between gap-4 animate-pulse">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 bg-stone-200 rounded w-1/4"></div>
              <div className="h-3 bg-stone-100 rounded w-1/2"></div>
            </div>
            <div className="h-5 bg-stone-100 rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
