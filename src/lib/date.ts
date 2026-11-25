import { addDays, format } from "date-fns";

export const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2).toString().padStart(2, "0");
  const minutes = i % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

export function getKstNowParts(now: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const rawHour = get("hour");
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = get("minute");

  return { year, month, day, hour, minute };
}

export function getKstTodayDate(now: Date = new Date()): Date {
  const { year, month, day } = getKstNowParts(now);
  return new Date(year, month - 1, day);
}

export function getKstTodayString(now: Date = new Date()): string {
  return format(getKstTodayDate(now), "yyyy-MM-dd");
}

export function getKstDateList(days: number = 15, now: Date = new Date()): Date[] {
  const today = getKstTodayDate(now);
  return Array.from({ length: days }, (_, i) => addDays(today, i));
}

export function isKstTodayOrPast(date: Date, now: Date = new Date()): boolean {
  return format(date, "yyyy-MM-dd") <= getKstTodayString(now);
}

export function isKstToday(date: Date, now: Date = new Date()): boolean {
  return format(date, "yyyy-MM-dd") === getKstTodayString(now);
}

export function getKstCurrentSlot(now: Date = new Date()): string {
  const { hour, minute } = getKstNowParts(now);
  const h = hour.toString().padStart(2, "0");
  const m = minute < 30 ? "00" : "30";
  return `${h}:${m}`;
}
