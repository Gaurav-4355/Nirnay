import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, RotateCcw } from 'lucide-react';

export default function TodayChip({ onDateChanged }) {
  const [todayInfo, setTodayInfo] = useState({ today: '', simulated: false });
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef(null);

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

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    <div className="relative" ref={popoverRef}>
      {/* Date Chip Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[13px] font-medium border transition-colors tabular-nums ${
          todayInfo.simulated
            ? 'bg-[#fff6e5] text-[#b26b00] border-[#b26b00]/30 hover:bg-[#ffeec2]'
            : 'bg-white text-[#5e6477] border-[#e7e9ee] hover:text-[#0f1222] hover:bg-[#f7f8fa]'
        }`}
        title="Adjust simulated date for demo meetings"
      >
        <Calendar className={`w-3.5 h-3.5 ${todayInfo.simulated ? 'text-[#b26b00]' : 'text-[#5e6477]'}`} strokeWidth={1.5} />
        <span>
          {todayInfo.today ? `Today: ${todayInfo.today}` : 'Today: ...'}
          {todayInfo.simulated && (
            <span className="ml-1 text-[11px] font-normal">
              (simulated)
            </span>
          )}
        </span>
      </button>

      {/* Date Adjustment Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-[#e7e9ee] rounded-[10px] shadow-elevated p-4 z-50 text-[13px] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#e7e9ee]">
            <span className="font-semibold text-[#0f1222]">Simulated date</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#8a90a2] hover:text-[#0f1222]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[12px] text-[#5e6477]">
            Demo meetings are dated in Dec 2026. Adjust today's date to test reminder and overdue calculations.
          </p>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-[#5e6477]">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-[#cdd1da] focus:border-[#1e35c7] rounded-[6px] text-[13px] text-[#0f1222] tabular-nums"
            />
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedDate('2026-12-17')}
              className="px-2 py-1 bg-[#f7f8fa] hover:bg-[#e7e9ee] text-[#0f1222] rounded-[4px] border border-[#e7e9ee]"
            >
              17 Dec 2026
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate('2026-12-21')}
              className="px-2 py-1 bg-[#f7f8fa] hover:bg-[#e7e9ee] text-[#0f1222] rounded-[4px] border border-[#e7e9ee]"
            >
              21 Dec 2026
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate('2026-12-29')}
              className="px-2 py-1 bg-[#f7f8fa] hover:bg-[#e7e9ee] text-[#0f1222] rounded-[4px] border border-[#e7e9ee]"
            >
              29 Dec 2026
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[#e7e9ee]">
            <button
              type="button"
              onClick={handleUseRealDate}
              disabled={saving || !todayInfo.simulated}
              className="text-[12px] text-[#5e6477] hover:text-[#0f1222] disabled:opacity-40"
            >
              Use real date
            </button>
            <button
              type="button"
              onClick={handleSaveSimulated}
              disabled={saving || !selectedDate}
              className="px-3 py-1.5 bg-[#1e35c7] hover:bg-[#172aa3] text-white rounded-[6px] text-[12px] font-semibold transition-colors"
            >
              {saving ? 'Saving...' : 'Apply date'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
