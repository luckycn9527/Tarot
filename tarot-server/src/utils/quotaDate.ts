export function dateOnlyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day) {
    throw new Error(`Unable to resolve date in time zone: ${timeZone}`);
  }
  return `${values.year}-${values.month}-${values.day}`;
}

/** Subtract a calendar day after resolving the site's date, including DST days. */
export function previousBusinessDate(timeZone: string, now = new Date()): string {
  const calendarDay = new Date(`${dateOnlyInTimeZone(now, timeZone)}T00:00:00.000Z`);
  calendarDay.setUTCDate(calendarDay.getUTCDate() - 1);
  return calendarDay.toISOString().slice(0, 10);
}

export interface QuotaWindow {
  businessDate: string;
  resetsAt: string;
  timeZone: string;
}

/** Find the next calendar-day boundary, including 23/25-hour DST days. */
export function quotaWindow(timeZone: string, now = new Date()): QuotaWindow {
  const businessDate = dateOnlyInTimeZone(now, timeZone);
  let low = now.getTime();
  let high = low + 48 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateOnlyInTimeZone(new Date(middle), timeZone) === businessDate) low = middle;
    else high = middle;
  }
  return { businessDate, resetsAt: new Date(high).toISOString(), timeZone };
}

/** Exact start/end instants for statistics, using the same site day as quota. */
export function businessDayRange(timeZone: string, now = new Date()) {
  const window = quotaWindow(timeZone, now);
  let low = now.getTime() - 48 * 60 * 60 * 1000;
  let high = now.getTime();
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateOnlyInTimeZone(new Date(middle), timeZone) === window.businessDate) high = middle;
    else low = middle;
  }
  return { ...window, startsAt: new Date(high).toISOString() };
}
