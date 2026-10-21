"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * The block types the corpus uses that our kit had no equivalent for
 * (data/corpus/vocabulary.json — class-name taxonomy across 59 sites).
 *
 *   marquee    11/59      split      13/59
 *   slider     14/59      panel      14/59
 *   accordion  11/59      burger     10/59
 *
 * Each is built to the corpus motion rules: scrubbed motion is `ease: "none"`,
 * discrete motion is easeOutExpo at ~0.4s, and nothing a timeline reveals is
 * left hidden under prefers-reduced-motion.
 */

/** marquee — 11/59. A band that drifts with the scroll instead of on a loop. */
export function Marquee({ words }: { words: string[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to("[data-marquee-track]", {
          xPercent: -35,
          ease: "none", // scrubbed
          scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="rule-top overflow-hidden py-8">
      <div data-marquee-track className="flex w-max gap-10 will-change-transform">
        {[...words, ...words, ...words].map((w, i) => (
          <span key={`${w}-${i}`} className="t-h2 whitespace-nowrap text-ink-soft">
            {w}
            <span className="text-accent"> · </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * split — 13/59. Two columns where one holds still and the other scrolls past
 * it. The sticky side is the cheap version of the pin the corpus leans on.
 */
export function Split({
  label,
  heading,
  items,
}: {
  label: string;
  heading: string;
  items: { k: string; v: string }[];
}) {
  return (
    <section className="rule-top grid gap-12 px-5 py-(--section-y) sm:px-8 lg:grid-cols-2 lg:gap-20">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <span className="meta">{label}</span>
        <h2 className="t-h2 mt-6 max-w-md text-balance">{heading}</h2>
      </div>
      <dl className="grid gap-px bg-rule">
        {items.map((it) => (
          <div key={it.k} className="reveal bg-paper py-7">
            <dt className="meta">{it.k}</dt>
            <dd className="t-lead mt-3 text-ink-soft">{it.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** accordion — 11/59. Details/summary, so it works with no JS and with a keyboard. */
export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="grid gap-px bg-rule">
      {items.map((it) => (
        <details key={it.q} className="group bg-paper">
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-7 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
            <span className="t-h2 max-w-3xl">{it.q}</span>
            <span className="meta shrink-0 transition-transform duration-[var(--dur)] group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="t-lead max-w-2xl pb-8 text-ink-soft">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

/**
 * slider — 14/59 (swiper 8/59). A drag/swipe rail. Native overflow scrolling,
 * so it is reachable by keyboard and needs no library; `tabIndex` because a
 * scroll region with no focusable children is otherwise a keyboard dead end.
 */
export function Slider({ cards }: { cards: { n: string; t: string; d: string }[] }) {
  return (
    <ul
      tabIndex={0}
      role="group"
      aria-label="Ölçüm katmanları"
      className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:px-8"
    >
      {cards.map((c) => (
        <li key={c.n} className="w-[78vw] shrink-0 snap-start sm:w-[42vw] lg:w-[26vw]">
          <article className="rule-top h-full pt-6">
            <span className="meta tabular-nums text-accent">{c.n}</span>
            <h3 className="t-h2 mt-4">{c.t}</h3>
            <p className="mt-4 text-ink-soft">{c.d}</p>
          </article>
        </li>
      ))}
    </ul>
  );
}

/**
 * burger — 10/59. Our template nav simply dropped its links below md, which
 * left a phone with no navigation at all. A dialog-less disclosure is enough.
 */
export function Nav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <nav
        aria-label="Ana menü"
        className="pointer-events-auto flex items-center justify-between px-5 py-4 mix-blend-difference sm:px-8"
      >
        <a href="#top" className="meta text-ink">
          Ölçülmüş
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="meta text-ink transition-opacity hover:opacity-60">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="meta -my-3 inline-flex min-h-11 min-w-11 items-center justify-center text-ink md:hidden"
        >
          {open ? "Kapat" : "Menü"}
        </button>
      </nav>
      {open && (
        <ul className="pointer-events-auto grid gap-px bg-rule md:hidden">
          {links.map((l) => (
            <li key={l.href} className="bg-paper">
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="t-h2 block px-5 py-5 sm:px-8"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
