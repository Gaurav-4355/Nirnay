import React, { useState, useEffect } from 'react';
import { Calendar, Check, X, RotateCcw } from 'lucide-react';

export default function TodayChip({ onDateChanged }) {
  const [todayInfo, setTodayInfo] = useState({ today: '', simulated: false });
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchToday = () => {
    fetch('/api/settings/today')
      .then((res) => res.json())
      .then((data) => {
        setTodayInfo(data);
        setSelectedDate(data.today || '');
      })
      .catch((err) => console.error('Error fetching today setting:', err));
  };

  useEffect(() => {
    fetchToday();
  }, []);

  const handleSaveSimulated = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/today', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setTodayInfo(data);
        setIsOpen(false);
        if (onDateChanged) onDateChanged(data);
      }
    } catch (err) {
      console.error('Error setting simulated today:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUseRealDate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/today', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: null }),
      });
      if (res.ok) {
        const data = await res.json();
        setTodayInfo(data);
        setSelectedDate(data.today || '');
        setIsOpen(false);
        if (onDateChanged) onDateChanged(data);
      }
    } catch (err) {
      console.error('Error resetting to real today:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      {/* Date Chip Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          todayInfo.simulated
            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 shadow-2xs'
        }`}
        title="Click to adjust simulated system date"
      >
        <Calendar className={`w-3.5 h-3.5 ${todayInfo.simulated ? 'text-amber-700' : 'text-stone-500'}`} />
        <span>
          {todayInfo.today ? `Today: ${todayInfo.today}` : 'Today: ...'}
          {todayInfo.simulated && (
            <span className="ml-1 text-[10px] bg-amber-200/80 text-amber-900 px-1 py-0.2 rounded font-normal">
              simulated
            </span>
          )}
        </span>
      </button>

      {/* Date Adjustment Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-xl shadow-xl p-4 z-50 text-xs space-y-3 animate-in fade-in duration-100">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200">
            <span className="font-semibold text-stone-900">Simulate date for demo</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-stone-400 hover:text-stone-700 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-stone-500 text-[11px] leading-relaxed">
            Demo meetings are scheduled around December 2026. Adjust the date to test overdue task alerts and reminder triggers.
          </p>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-stone-700">Select simulated date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-stone-400">Presets:</span>
            {[
              { label: 'Dec 01 (M1)', date: '2026-12-01' },
              { label: 'Dec 10 (M2)', date: '2026-12-10' },
              { label: 'Dec 17', date: '2026-12-17' },
              { label: 'Dec 22', date: '2026-12-22' },
            ].map((preset) => (
              <button
                key={preset.date}
                type="button"
                onClick={() => setSelectedDate(preset.date)}
                className="text-[10px] px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-stone-200">
            <button
              onClick={handleUseRealDate}
              disabled={saving}
              className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Use real date</span>
            </button>
            <button
              onClick={handleSaveSimulated}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-lg shadow-xs transition-colors"
            >
              <Check className="w-3 h-3" />
              <span>{saving ? 'Saving...' : 'Apply'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
