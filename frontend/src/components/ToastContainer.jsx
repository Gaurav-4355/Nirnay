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
            className={`pointer-events-auto p-3.5 rounded-[8px] border shadow-elevated flex items-start justify-between gap-3 text-[13px] transition-all bg-surface ${
              isSuccess
                ? 'border-green/40 text-green'
                : isError
                ? 'border-red/40 text-red'
                : 'border-accent/40 text-ink'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-green shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="w-4 h-4 text-red shrink-0 mt-0.5" />}
              {!isSuccess && !isError && <Info className="w-4 h-4 text-accent-text shrink-0 mt-0.5" />}
              <span className="leading-snug font-medium text-ink">{toast.message}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-ink-faint hover:text-ink p-0.5 rounded shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
