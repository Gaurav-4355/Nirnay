import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-[8px] border shadow-elevated flex items-start justify-between gap-3 text-[13px] transition-all bg-white ${
              isSuccess
                ? 'border-[#14795a]/40 text-[#14795a]'
                : isError
                ? 'border-[#d0272d]/40 text-[#d0272d]'
                : 'border-[#1e35c7]/40 text-[#0f1222]'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#14795a] shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="w-4 h-4 text-[#d0272d] shrink-0 mt-0.5" />}
              {!isSuccess && !isError && <Info className="w-4 h-4 text-[#1e35c7] shrink-0 mt-0.5" />}
              <span className="leading-snug font-medium text-[#0f1222]">{toast.message}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#8a90a2] hover:text-[#0f1222] p-0.5 rounded shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
