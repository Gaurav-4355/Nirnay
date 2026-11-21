import React, { useState, useEffect, useRef } from 'react';
import { Search, Compass, CheckSquare, AlertTriangle, Send, MessageSquare, Award, FileText, BookOpen, PlusCircle, LayoutDashboard, X } from 'lucide-react';

export default function QuickSwitcher({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const screens = [
    { id: 'dashboard', label: 'Today', icon: LayoutDashboard, group: 'Overview' },
    { id: 'new_meeting', label: 'New meeting', icon: PlusCircle, group: 'Capture' },
    { id: 'decisions', label: 'Decisions', icon: Compass, group: 'Memory' },
    { id: 'conflicts', label: 'Conflicts', icon: AlertTriangle, group: 'Memory' },
    { id: 'ask', label: 'Ask Nirnay', icon: MessageSquare, group: 'Memory' },
    { id: 'brief', label: 'Next meeting brief', icon: BookOpen, group: 'Memory' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, group: 'Work' },
    { id: 'outbox', label: 'Waiting for your approval', icon: Send, group: 'Work' },
    { id: 'digests', label: 'Weekly summaries', icon: FileText, group: 'Work' },
    { id: 'accuracy', label: 'How accurate is Nirnay?', icon: Award, group: 'Proof' },
  ];

  const filtered = screens.filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase()) ||
    s.group.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (screenId) => {
    onNavigate(screenId);
    onClose();
  };

  const handleAsk = () => {
    onNavigate('ask', query);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (filtered.length > 0) {
        handleSelect(filtered[0].id);
      } else if (query.trim()) {
        handleAsk();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/15 flex items-start justify-center pt-24 px-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-[#e7e9ee] rounded-[10px] shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-[#e7e9ee]">
          <Search className="w-4 h-4 text-[#8a90a2] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a screen or ask Nirnay..."
            className="w-full bg-transparent text-[14px] text-[#0f1222] placeholder-[#8a90a2] focus:outline-none"
          />
          <kbd className="text-[11px] text-[#8a90a2] bg-[#f7f8fa] border border-[#e7e9ee] px-1.5 py-0.5 rounded-[4px] font-sans">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-1.5 divide-y divide-[#e7e9ee]">
          <div className="space-y-0.5 pb-1">
            {filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] text-left text-[13px] text-[#0f1222] hover:bg-[#f7f8fa] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-[#5e6477]" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className="text-[11px] text-[#8a90a2]">{item.group}</span>
                </button>
              );
            })}
          </div>

          {/* Ask Nirnay Option */}
          {query.trim() && (
            <div className="pt-1">
              <button
                onClick={handleAsk}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-left text-[13px] text-[#1e35c7] hover:bg-[#eef1fd] transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-[#1e35c7]" />
                <span>
                  Ask Nirnay: <span className="font-semibold italic">"{query}"</span>
                </span>
              </button>
            </div>
          )}

          {filtered.length === 0 && !query.trim() && (
            <div className="p-4 text-center text-[13px] text-[#8a90a2]">
              No screens found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
