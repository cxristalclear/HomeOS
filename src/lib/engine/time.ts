/** Shared time helpers for the due engine. */

export const DAY = 86_400_000;

/** Local-midnight timestamp for the day containing `t`. */
export const startOfDay = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
