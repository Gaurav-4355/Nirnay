import React from 'react';

export default function LoadingSkeleton({ rows = 5, type = 'ledger', className = '' }) {
  if (type === 'cards') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 rounded-[10px] border border-[#e7e9ee] bg-white space-y-3 animate-pulse">
            <div className="h-4 bg-[#f7f8fa] rounded-[4px] w-1/3"></div>
            <div className="space-y-2 pt-2">
              <div className="h-16 bg-[#f7f8fa] rounded-[6px]"></div>
              <div className="h-16 bg-[#f7f8fa] rounded-[6px]"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`border border-[#e7e9ee] rounded-[10px] bg-white overflow-hidden ${className}`}>
      <div className="h-10 bg-[#f7f8fa] border-b border-[#e7e9ee] px-6 flex items-center">
        <div className="h-3 bg-[#e7e9ee] rounded w-48 animate-pulse"></div>
      </div>
      <div className="divide-y divide-[#e7e9ee]">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center justify-between gap-4 animate-pulse">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 bg-[#f7f8fa] rounded w-1/4"></div>
              <div className="h-3 bg-[#f7f8fa] rounded w-1/2"></div>
            </div>
            <div className="h-5 bg-[#f7f8fa] rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
