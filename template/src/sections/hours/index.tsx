import type { HoursSection, SiteConfig } from "@/lib/schema";
import { cn } from "cn";

interface HoursProps {
  section: HoursSection;
  config: SiteConfig;
}

/** Turkish weekday names indexed by ISO weekday (1 = Monday). */
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
 * Opening hours from config: the day-by-day table when the business publishes
 * a day mapping, otherwise the verbatim string it does publish
 * (config.hoursNote, e.g. "10.00-19.30"). The schema guarantees one of the
 * two exists; neither is ever inferred from the other (DECISIONS D8).
 * "compact" tightens the table rows.
 */
export function Hours({ section, config }: HoursProps) {
  const isCompact = section.variant === "compact";

  if (config.openingHours.length === 0) {
    return (
      <section id={section.id} className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="font-heading text-3xl font-semibold text-foreground">
          {section.title ?? "Çalışma Saatleri"}
        </h2>
        {config.hoursNote !== null && (
          <p className="mt-6 text-2xl font-semibold tabular-nums text-foreground">
            {config.hoursNote}
          </p>
        )}
        {section.note !== undefined && (
          <p className="mt-4 text-sm text-muted-foreground">{section.note}</p>
        )}
      </section>
    );
  }

  return (
    <section id={section.id} className="mx-auto max-w-3xl px-4 py-16">
      <h2 className="font-heading text-3xl font-semibold text-foreground">
        {section.title ?? "Çalışma Saatleri"}
      </h2>
      <table className="mt-8 w-full border-separate border-spacing-0 overflow-hidden rounded-xl border border-brand-100 text-left text-base">
        <caption className="sr-only">Haftalık çalışma saatleri</caption>
        <tbody>
          {config.openingHours.map((entry) => (
            <tr key={entry.day} className="odd:bg-brand-50/60">
              <th
                scope="row"
                className={cn(
                  "px-5 font-semibold text-foreground",
                  isCompact ? "py-2" : "py-3",
                )}
              >
                {WEEKDAYS_TR[entry.day]}
              </th>
              <td
                className={cn(
                  "px-5 text-right",
                  isCompact ? "py-2" : "py-3",
                  entry.opens === null
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {entry.opens === null
                  ? "Kapalı"
                  : `${entry.opens} – ${entry.closes}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {section.note !== undefined && (
        <p className="mt-4 text-sm text-muted-foreground">{section.note}</p>
      )}
    </section>
  );
}
