/**
 * Calculates the next occurrence date for a recurring task based on frequency and parameters.
 *
 * @param {object} schedule
 * @param {string} schedule.frequency - 'daily' | 'weekly' | 'monthly'
 * @param {number} [schedule.interval=1] - Every N periods
 * @param {number[]} [schedule.daysOfWeek] - Array of day numbers [0..6] (0 = Sunday)
 * @param {number} [schedule.dayOfMonth=1] - Day of month [1..31]
 * @param {Date|string} [schedule.from=new Date()] - Reference date to calculate next from
 * @returns {Date} Next execution date
 */
export const calculateNextRunDate = ({
  frequency,
  interval = 1,
  daysOfWeek = [],
  dayOfMonth = 1,
  from = new Date(),
}) => {
  const base = new Date(from);
  const step = Math.max(Number(interval) || 1, 1);

  if (frequency === "daily") {
    const next = new Date(base);
    next.setDate(next.getDate() + step);
    return next;
  }

  if (frequency === "weekly") {
    // If specific days of week provided (e.g. [1, 3, 5] for Mon, Wed, Fri)
    if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
      const sortedDays = [...new Set(daysOfWeek)].sort((a, b) => a - b);
      const currentDay = base.getDay();

      // Look for next day in the same week
      const nextDaySameWeek = sortedDays.find((d) => d > currentDay);
      if (nextDaySameWeek !== undefined) {
        const next = new Date(base);
        next.setDate(next.getDate() + (nextDaySameWeek - currentDay));
        return next;
      }

      // Otherwise wrap to the first allowed day in the next interval week
      const firstDay = sortedDays[0];
      const daysUntilEndOfWeek = 7 - currentDay;
      const daysInNextInterval = (step - 1) * 7;
      const next = new Date(base);
      next.setDate(next.getDate() + daysUntilEndOfWeek + daysInNextInterval + firstDay);
      return next;
    }

    // Default weekly step
    const next = new Date(base);
    next.setDate(next.getDate() + step * 7);
    return next;
  }

  if (frequency === "monthly") {
    const next = new Date(base);
    next.setMonth(next.getMonth() + step);
    const targetDay = Math.min(Math.max(Number(dayOfMonth) || 1, 1), 31);
    // Handle months with fewer days
    const maxDaysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(targetDay, maxDaysInMonth));
    return next;
  }

  // Fallback 1 day
  const fallback = new Date(base);
  fallback.setDate(fallback.getDate() + 1);
  return fallback;
};

/**
 * Checks if a recurring schedule has passed its expiration / end date.
 *
 * @param {Date|null} endDate
 * @param {Date} nextRunAt
 * @returns {boolean}
 */
export const isRecurringExpired = (endDate, nextRunAt) => {
  if (!endDate) return false;
  return new Date(nextRunAt) > new Date(endDate);
};
