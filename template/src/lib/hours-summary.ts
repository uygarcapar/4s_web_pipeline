import type { SiteConfig } from "@/lib/schema";

const WEEKDAYS_TR: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

/**
 * One line of opening hours, for a section that has room for a fact but not
 * for a table.
 *
 * design-rules.md §8 requires hours in the first viewport, and a hero with
 * no photograph has nowhere to hide them. The full seven-row table is the
 * `hours` section's job; this is the summary a hero or a closing block can
 * carry.
 *
 * Returns `null` when the business publishes nothing — D8: a site with no
 * hours shows no hours rather than an invented "09:00–18:00".
 *
 * Grouping, not inference. Consecutive days sharing a range collapse into
 * "Pazartesi–Cuma 09:00–19:00"; days the business did not publish are simply
 * absent. Nothing is derived from a neighbouring day — an LLM extraction of
 * one real client's page returned "Mon–Sat 10:00–19:30, Sunday closed" when
 * the page stated none of it.
 */
export function hoursSummary(config: SiteConfig): string | null {
  if (config.hoursNote !== null) return config.hoursNote;

  const open = config.openingHours.filter(
    (e): e is typeof e & { opens: string; closes: string } =>
      e.opens !== null && e.closes !== null,
  );
  if (open.length === 0) return null;

  const sorted = [...open].sort((a, b) => a.day - b.day);
  const runs: Array<{ from: number; to: number; opens: string; closes: string }> = [];

  for (const entry of sorted) {
    const last = runs.at(-1);
    if (
      last !== undefined &&
      last.to === entry.day - 1 &&
      last.opens === entry.opens &&
      last.closes === entry.closes
    ) {
      last.to = entry.day;
      continue;
    }
    runs.push({
      from: entry.day,
      to: entry.day,
      opens: entry.opens,
      closes: entry.closes,
    });
  }

  // Two runs is the most a single line can carry and still be read at a
  // glance; beyond that the hours section is the right place.
  return runs
    .slice(0, 2)
    .map((run) => {
      const days =
        run.from === run.to
          ? WEEKDAYS_TR[run.from]
          : `${WEEKDAYS_TR[run.from]}–${WEEKDAYS_TR[run.to]}`;
      return `${days} ${run.opens}–${run.closes}`;
    })
    .join(" · ");
}
