"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import type { StatementSection, SiteConfig } from "@/lib/schema";

/**
 * The business's own sentence, lit word by word as the reader scrolls through
 * it. The text itself is what changes — not its position — which is the
 * transformation design-rules.md §3 asks every site to carry somewhere
 * (template/pattern-library.md §2.1).
 *
 * Accessibility: the sentence is written once as a plain string inside the
 * paragraph's `aria-label`, and the per-word spans are hidden from the
 * accessibility tree. Without that a screen reader announces twenty separate
 * fragments instead of one sentence.
 *
 * Under `prefers-reduced-motion` no timeline runs and every word is already at
 * full opacity — the CSS default — so nothing is left hidden.
 */
export function Statement({
  section,
}: {
  section: StatementSection;
  config: SiteConfig;
}) {
  const root = useRef<HTMLElement>(null);
  const words = section.text.split(/\s+/).filter(Boolean);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".statement-word",
          { opacity: 0.17 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.5,
            scrollTrigger: {
              trigger: root.current,
              start: "top 78%",
              end: "bottom 55%",
              scrub: true,
            },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id={section.id}
      className="mx-auto w-full max-w-5xl px-5 py-[var(--section-y)] sm:px-8"
    >
      <p aria-label={section.text} className="t-h2-col text-balance text-foreground">
        {words.map((word, i) => (
          <span aria-hidden key={`${word}-${i}`} className="statement-word">
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </section>
  );
}
