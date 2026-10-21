"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { formatPhoneTR, telHref } from "@/lib/format";
import type { SiteConfig, VisitSection } from "@/lib/schema";

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
 * Where they are, when they are open, and the number — as one section.
 *
 * The reference build's note is the argument for folding these together:
 * "the part the award-winning references never need and a clinic cannot do
 * without". Split across three sections it reads as a form; as one it reads
 * as a decision (template/pattern-library.md §2.2).
 *
 * Each row slides up from under its own rule so practical information still
 * belongs to the page's motion language without becoming a puzzle.
 */
export function Visit({
  section,
  config,
}: {
  section: VisitSection;
  config: SiteConfig;
}) {
  const root = useRef<HTMLElement>(null);
  const { contact, openingHours, hoursNote } = config;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".visit-row", {
          yPercent: 110,
          stagger: 0.07,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 75%" },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className="mx-auto w-full max-w-5xl px-5 py-[var(--section-y)] sm:px-8"
    >
      <h2 id={`${section.id}-title`} className="t-h2-col text-foreground">
        {section.title ?? "Bize Gelin"}
      </h2>

      <dl className="mt-12 grid gap-px border-t border-paper-300">
        <Row label="Adres">
          <span className="t-body text-foreground">
            {contact.address}
            <br />
            {contact.district} / {contact.city}
          </span>
        </Row>

        <Row label="Çalışma Saatleri">
          {openingHours.length > 0 ? (
            <span className="flex flex-col gap-1">
              {openingHours.map((entry) => (
                <span key={entry.day} className="t-body flex gap-4 text-foreground">
                  <span className="w-28 shrink-0 text-paper-500">
                    {WEEKDAYS_TR[entry.day]}
                  </span>
                  <span className="tabular-nums">
                    {entry.opens === null
                      ? "Kapalı"
                      : `${entry.opens} – ${entry.closes}`}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            hoursNote !== null && (
              <span className="t-h3 tabular-nums text-foreground">{hoursNote}</span>
            )
          )}
        </Row>

        <Row label="Telefon">
          {/* -my cancels the padding for layout so the row keeps its height
              while the tap area still reaches 44px. */}
          <a
            href={telHref(contact.phoneE164)}
            className="t-h3 -my-2 inline-flex min-h-11 items-center whitespace-nowrap tabular-nums text-foreground underline-offset-8 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {formatPhoneTR(contact.phoneE164)}
          </a>
        </Row>
      </dl>
    </section>
  );
}

/** One label/value pair, masked so its content can slide up from the rule. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden border-b border-paper-300 py-6">
      <div className="visit-row flex flex-col gap-2 sm:flex-row sm:gap-10">
        <dt className="meta w-44 shrink-0 pt-1 text-paper-500">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}
