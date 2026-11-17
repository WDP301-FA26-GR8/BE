/** Seconds to wait after the 1st, 2nd … failed attempt; every attempt after the last waits the last. */
const BACKOFF_SECONDS = [1, 5, 30, 60, 300] as const;
/** Up to a fifth earlier or later, so deliveries that failed together do not all come back at once. */
const JITTER = 0.2;

/**
 * When a delivery that failed for a reason that may pass is taken again. There is no last attempt: the history of a call is never
 * dropped because MongoDB was down for long; the row waits, and the backlog says so.
 */
export function retryAt(attempts: number, now: Date, random: () => number = Math.random): Date {
  const index = Math.min(Math.max(attempts, 1), BACKOFF_SECONDS.length) - 1;
  const base = BACKOFF_SECONDS[index] * 1000;
  const jitter = base * JITTER * (random() * 2 - 1);

  return new Date(now.getTime() + Math.round(base + jitter));
}
