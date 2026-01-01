'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type EventRow = {
  id: number;
  type: string;
  startTime: string;
  endTime: string | null;
  note: string | null; // <--- ADDED THIS FIELD
  data: string;
};

// HELPER 1: Input Format
const toInputFormat = (dateStr: string) => {
  const date = new Date(dateStr);
  const offset = date.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
  return localISOTime;
};

// HELPER 2: Display Time (European 24h)
const formatDisplayTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// HELPER 3: Duration
const getDurationString = (start: string, end: string) => {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const getEventStyle = (type: string) => {
  switch (type) {
    case 'SLEEP': return { icon: '😴', bg: 'bg-blue-100 dark:bg-blue-900' };
    case 'FEED': return { icon: '🍼', bg: 'bg-pink-100 dark:bg-pink-900' };
    case 'DIAPER': return { icon: '💩', bg: 'bg-yellow-100 dark:bg-yellow-900' };
    case 'MEDICINE': return { icon: '💊', bg: 'bg-green-100 dark:bg-green-900' };
    case 'WEIGHT': return { icon: '⚖️', bg: 'bg-cyan-100 dark:bg-cyan-900' };
    default: return { icon: '📝', bg: 'bg-gray-100 dark:bg-gray-700' };
  }
};

export default function ActivityList({ initialEvents }: { initialEvents: EventRow[] }) {
  const router = useRouter();
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editValue, setEditValue] = useState(''); 

  const handleRowClick = (event: EventRow) => {
    setSelectedEvent(event);
    setEditTime(toInputFormat(event.startTime));
    const dataObj = JSON.parse(event.data || '{}');
    if (dataObj.amount) setEditValue(dataObj.amount);
    else setEditValue('');
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!confirm("Are you sure you want to delete this?")) return;
    await fetch('/api/events', { method: 'DELETE', body: JSON.stringify({ id: selectedEvent.id }) });
    setSelectedEvent(null);
    router.refresh(); 
  };

  const handleSave = async () => {
    if (!selectedEvent) return;
    const currentData = JSON.parse(selectedEvent.data || '{}');
    if (editValue) currentData.amount = editValue; 
    await fetch('/api/events', {
      method: 'PATCH',
      body: JSON.stringify({ id: selectedEvent.id, startTime: editTime, data: currentData }),
    });
    setSelectedEvent(null);
    router.refresh();
  };

  return (
    <>
      <div className="space-y-3">
        {initialEvents.length === 0 ? (
          <p className="text-gray-400 text-center italic mt-10">No events logged yet.</p>
        ) : (
          initialEvents.map((event) => {
            const style = getEventStyle(event.type);
            const eventData = JSON.parse(event.data || '{}');
            
            // --- DECIDE THE SUB-TEXT ---
            let subText = "Logged"; 
            
            // 1. If Sleep: empty
            if (event.type === 'SLEEP') subText = ""; 
            
            // 2. If Weight: show value
            if (event.type === 'WEIGHT' && eventData.amount) subText = `${eventData.amount} kg`;
            
            // 3. If NOTE: Show the actual note text!
            // 'truncate' class in CSS will cut it off with "..." if it's too long
            if (event.type === 'NOTE' && event.note) {
                subText = event.note; 
            }
            
            // --- TIME AND DURATION ---
            let timeDisplay = formatDisplayTime(event.startTime);
            let durationBadge = null;

            if (event.type === 'SLEEP') {
              if (event.endTime) {
                timeDisplay = `${formatDisplayTime(event.startTime)} - ${formatDisplayTime(event.endTime)}`;
                const duration = getDurationString(event.startTime, event.endTime);
                durationBadge = (
                  <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-200">
                    {duration}
                  </span>
                );
              } else {
                timeDisplay = `💤 Sleeping since ${formatDisplayTime(event.startTime)}`;
              }
            }

            return (
              <div 
                key={event.id} 
                onClick={() => handleRowClick(event)} 
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden"> 
                  {/* Added overflow-hidden above to help with long notes */}
                  
                  <span className={`${style.bg} p-2 rounded-full text-lg flex-shrink-0`}>{style.icon}</span>
                  
                  <div className="min-w-0"> {/* min-w-0 ensures text truncation works */}
                    <p className="font-medium capitalize flex items-center whitespace-nowrap">
                      {event.type.toLowerCase()}
                      {durationBadge}
                    </p>
                    
                    {/* Render the subText (Note content) with truncation */}
                    {subText && (
                        <p className="text-xs text-gray-500 truncate pr-2">
                            {subText}
                        </p>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-400 whitespace-nowrap flex-shrink-0">{timeDisplay}</span>
              </div>
            );
          })
        )}
      </div>

      {/* --- EDIT MODAL (Unchanged) --- */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 dark:text-white">
              Edit {selectedEvent.type.toLowerCase()}
            </h3>

            <label className="block text-sm text-gray-500 mb-1">Time</label>
            <input 
              type="datetime-local"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />

            {(selectedEvent.type === 'WEIGHT' || editValue !== '') && (
              <>
                <label className="block text-sm text-gray-500 mb-1">Value (kg/ml)</label>
                <input 
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full p-3 mb-6 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </>
            )}

            <div className="flex gap-3 mt-4">
              <button 
                onClick={handleDelete}
                className="px-4 py-3 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200"
              >
                Delete
              </button>
              <div className="flex-1 flex gap-2">
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1 py-3 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}