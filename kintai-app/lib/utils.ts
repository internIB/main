export function getShiftMonthKey(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (day >= 21) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}_${String(nextMonth).padStart(2, '0')}`;
  }
  return `${year}_${String(month).padStart(2, '0')}`;
}

export function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function isOlderThanMonths(date: Date, months: number): boolean {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return date < cutoff;
}

export function getTodayJST(): string {
  return new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
}

export function getNowJSTDate(): Date {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jst;
}

export function getPeriodRange(monthKey: string): { start: string; end: string } {
  const [yearStr, monthStr] = monthKey.split('_');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-21`;
  const end = `${year}-${String(month).padStart(2, '0')}-20`;
  return { start, end };
}

export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
