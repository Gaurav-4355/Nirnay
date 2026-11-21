import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Check, X, RotateCcw } from 'lucide-react';

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
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          todayInfo.simulated
            ? 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-950/70 shadow-sm shadow-amber-950/50'
            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
        }`}
        title="Click to adjust simulated system date"
      >
        <Calendar className={`w-3.5 h-3.5 ${todayInfo.simulated ? 'text-amber-400' : 'text-slate-400'}`} />
        <span>Today: {todayInfo.today || '...'}</span>
        {todayInfo.simulated && (
          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
            simulated
          </span>
        )}
      </button>

      {/* Date Picker Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 text-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Simulated Today</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mt-2.5 mb-3 leading-relaxed">
            Nirnay checks deadlines, due-soon reminders and weekly digests relative to this date.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                System Date (YYYY-MM-DD)
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSaveSimulated}
                disabled={saving || !selectedDate}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Set Date'}</span>
              </button>

              <button
                onClick={handleUseRealDate}
                disabled={saving || !todayInfo.simulated}
                className="flex items-center justify-center gap-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-all"
                title="Reset to today's real calendar date"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Real</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
