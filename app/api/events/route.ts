import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // We extract 'data' here so we can save the weight/medicine details
    const { type, note, data } = body;

    if (!type) return new NextResponse("Missing type", { status: 400 });

    // ==========================================
    // 1. SLEEP LOGIC (Toggle Start/Stop)
    // ==========================================
    if (type === 'SLEEP') {
      const activeSleep = db.prepare(`
        SELECT id FROM events 
        WHERE type = 'SLEEP' AND endTime IS NULL 
        LIMIT 1
      `).get() as { id: number } | undefined;

      if (activeSleep) {
        // STOP SLEEPING
        db.prepare(`
          UPDATE events 
          SET endTime = ? 
          WHERE id = ?
        `).run(new Date().toISOString(), activeSleep.id);
        
        return NextResponse.json({ status: 'stopped', id: activeSleep.id });
      } else {
        // START SLEEPING
        const info = db.prepare(`
          INSERT INTO events (type, startTime, data)
          VALUES (?, ?, ?)
        `).run('SLEEP', new Date().toISOString(), JSON.stringify({}));

        return NextResponse.json({ status: 'started', id: info.lastInsertRowid });
      }
      // ⚠️ IMPORTANT: Sleep logic Returns here. It does not go further.
    }

    // ==========================================
    // 2. STANDARD LOGIC (Weight, Feed, Diaper, Medicine)
    // ==========================================
    // This part runs for EVERYTHING that is NOT Sleep.
    
    const insertStmt = db.prepare(`
      INSERT INTO events (type, startTime, note, data)
      VALUES (?, ?, ?, ?)
    `);

    const info = insertStmt.run(
      type,
      new Date().toISOString(),
      note || null,
      // We save the 'data' object (like { amount: 5.2 }) as a string here
      JSON.stringify(data || {}) 
    );

    return NextResponse.json({ message: "Logged", id: info.lastInsertRowid });

  } catch (error) {
    console.error("API Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// GET endpoint (Used by the Sleep button to check status)
export async function GET() {
  // 1. Check Sleep Status
  const activeSleep = db.prepare(`
    SELECT id FROM events 
    WHERE type = 'SLEEP' AND endTime IS NULL 
    LIMIT 1
  `).get();

  // 2. Check Medicine Status (Resetting at 6 AM)
  const now = new Date();
  const RESET_HOUR = 6; // <-- Change this number later to change frequency/time
  
  // Calculate the "Start of the current period"
  // If it is currently 5 AM, the "day" started yesterday at 6 AM.
  // If it is currently 7 AM, the "day" started today at 6 AM.
  let cutoffDate = new Date(now);
  if (now.getHours() < RESET_HOUR) {
    cutoffDate.setDate(now.getDate() - 1); // Go back one day
  }
  cutoffDate.setHours(RESET_HOUR, 0, 0, 0);

  const medicineLog = db.prepare(`
    SELECT id FROM events 
    WHERE type = 'MEDICINE' AND startTime >= ? 
    LIMIT 1
  `).get(cutoffDate.toISOString());

  return NextResponse.json({ 
    isSleeping: !!activeSleep,
    medicineGiven: !!medicineLog 
  });
}

// 3. DELETE: Remove an event
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) return new NextResponse("Missing ID", { status: 400 });

    const stmt = db.prepare('DELETE FROM events WHERE id = ?');
    stmt.run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return new NextResponse("Error deleting", { status: 500 });
  }
}

// 4. PATCH: Update an event (Edit time, value, etc.)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, startTime, data } = body;

    // We allow updating Start Time and Data (e.g. weight amount)
    const stmt = db.prepare(`
      UPDATE events 
      SET startTime = ?, data = ?
      WHERE id = ?
    `);

    stmt.run(
      new Date(startTime).toISOString(), 
      JSON.stringify(data || {}), 
      id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Error updating", { status: 500 });
  }
}