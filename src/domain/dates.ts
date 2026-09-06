import type { IsoDate } from './types.js';

const DAY_MS = 86_400_000;

export function parseIsoDate(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const parsed = parseIsoDate(date);
  return toIsoDate(new Date(parsed.getTime() + days * DAY_MS));
}

export function startOfWeek(date: IsoDate): IsoDate {
  const parsed = parseIsoDate(date);
  const day = parsed.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(date, delta);
}

export function weekDays(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function todayIso(): IsoDate {
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const d = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as IsoDate;
}
