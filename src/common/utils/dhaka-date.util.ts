const DHAKA_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Returns the current Bangladesh calendar day as UTC instants. */
export function getDhakaTodayRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const startMs =
    Date.UTC(value('year'), value('month') - 1, value('day')) -
    DHAKA_UTC_OFFSET_MS;

  return {
    start: new Date(startMs),
    end: new Date(startMs + 24 * 60 * 60 * 1000 - 1),
  };
}

/** Returns the current Bangladesh calendar month-to-date as UTC instants. */
export function getDhakaMonthToDateRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const today = getDhakaTodayRange(now);
  const dayOfMonth = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
    }).format(now),
  );

  return {
    start: new Date(
      today.start.getTime() - (dayOfMonth - 1) * 24 * 60 * 60 * 1000,
    ),
    end: today.end,
  };
}
