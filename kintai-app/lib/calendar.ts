import { ShiftEntry } from '../types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  shift: ShiftEntry
): Promise<string> {
  const workTypeLabel = shift.workType.replace('申請', '');
  const title = `【${workTypeLabel}】${shift.name}`;

  let eventBody: any;

  if (shift.startTime && shift.endTime) {
    eventBody = {
      summary: title,
      description: `種別: ${workTypeLabel}\n名前: ${shift.name}`,
      start: {
        dateTime: `${shift.date}T${shift.startTime}:00+09:00`,
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: `${shift.date}T${shift.endTime}:00+09:00`,
        timeZone: 'Asia/Tokyo',
      },
    };
  } else {
    eventBody = {
      summary: title,
      description: `種別: ${workTypeLabel}\n名前: ${shift.name}`,
      start: { date: shift.date },
      end: { date: shift.date },
    };
  }

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Calendar API error: ${err}`);
  }

  const data = await response.json();
  return data.id as string;
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const err = await response.text();
    throw new Error(`Google Calendar delete error: ${err}`);
  }
}
