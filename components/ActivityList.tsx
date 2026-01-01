'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type EventRow = {
  id: number;
  type: string;
  startTime: string;
  endTime: string | null;
  data: string;
};

// Helper to format date for the HTML Input (requires YYYY-MM-DDThh:mm format)
const toInputFormat = (dateStr: string) => {
  const date = new Date(dateStr);
  // Adjust to local timezone roughly for the input
  const offset = date.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
  return localISOTime;
};

// Helper for display time
const formatDisplayTime = (dateStr: string) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: 'numeric', hour12: true
  }).format(new Date(dateStr));
};

// Styles helper
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
  
  // Edit Form States
  const [editTime, setEditTime] = useState('');
  const [editValue, setEditValue] = useState(''); // Used for Weight/Amount

  // Open Modal
  const handleRowClick = (event: EventRow) => {
    setSelectedEvent(event);
    setEditTime(toInputFormat(event.startTime));
    
    // Parse data to see if there is a value to edit (like weight)
    const dataObj = JSON.parse(event.data || '{}');
    if (dataObj.amount) setEditValue(dataObj.amount);
    else setEditValue('');
  };

  // DELETE Action
  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!confirm("Are you sure you want to delete this?")) return;

    await fetch('/api/events', {
      method: 'DELETE',
      body: JSON.stringify({ id: selectedEvent.id }),
    });

    setSelectedEvent(null);
    router.refresh(); // Refresh the list
  };

  // SAVE (Update) Action
  const handleSave = async () => {
    if (!selectedEvent) return;

    // Reconstruct the data object
    const currentData = JSON.parse(selectedEvent.data || '{}');
    if (editValue) currentData.amount = editValue; // Update amount if it exists

    await fetch('/api/events', {
      method: 'PATCH',
      body: JSON.stringify({
        id: selectedEvent.id,
        startTime: editTime, // Send the new time
        data: currentData    // Send the new data
      }),
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
            
            // Subtext Logic
            let subText = "Logged";
            if (event.type === 'WEIGHT' && eventData.amount) subText = `${eventData.amount} kg`;
            
            // Time Logic
            let timeDisplay = formatDisplayTime(event.startTime);
            if (event.type === 'SLEEP') {
              timeDisplay = event.endTime 
                ? `${formatDisplayTime(event.startTime)} - ${formatDisplayTime(event.endTime)}` 
                : "💤 Sleeping...";
            }

            return (
              <div 
                key={event.id} 
                onClick={() => handleRowClick(event)} // CLICK HANDLER
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`${style.bg} p-2 rounded-full text-lg`}>{style.icon}</span>
                  <div>
                    <p className="font-medium capitalize">{event.type.toLowerCase()}</p>
                    <p className="text-xs text-gray-500">{subText}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-400">{timeDisplay}</span>
              </div>
            );
          })
        )}
      </div>

      {/* --- EDIT MODAL --- */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 dark:text-white">
              Edit {selectedEvent.type.toLowerCase()}
            </h3>

            {/* Time Input */}
            <label className="block text-sm text-gray-500 mb-1">Time</label>
            <input 
              type="datetime-local"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />

            {/* Value Input (Only for Weight/Events with 'amount') */}
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