"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { parallaxInFrame, swapInPlace } from "@/lib/motion";
import type { SiteConfig, TeamSection } from "@/lib/schema";

/**
 * Team archetype: the text changes rather than moves.
 *
 * The left half holds still and its name/role pair swaps in place as each
 * portrait passes the middle of the screen — the text transformation the
 * design rules require (§3). The portraits themselves drift at a different
 * speed than the page.
 *
 * Every name is in the DOM at once and stacked, so a screen reader and a
 * no-JS browser get the full list in order. The stacking is applied by CSS
 * only when something is actually going to hide the others (`html.js`, wide,
 * motion allowed) — otherwise five names would print on top of each other.
 *
 * Portraits shot on a white seamless are multiplied onto the card so that
 * white dissolves into the page instead of leaving rectangles floating on it.
 */
export function TeamStickySwap({
  section,
}: {
  section: TeamSection;
  config: SiteConfig;
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>(".team-card", root.current);
        const labels = gsap.utils.toArray<HTMLElement>(".team-label", root.current);

        for (const card of cards) {
          parallaxInFrame({ card, photo: card.querySelector(".team-photo") });
          gsap.from(card, {
            clipPath: "inset(100% 0% 0% 0%)",
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 85%" },
          });
        }

        if (labels.length) swapInPlace({ cards, labels });
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
      className="relative bg-paper-100 py-[var(--section-y)] sm:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
        {/* the half that stays */}
        <div className="lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:justify-center">
          <h2 id={`${section.id}-title`} className="meta text-paper-500">
            {section.title}
          </h2>
          {section.intro !== undefined && (
            <p className="t-lead mt-6 max-w-md text-ink-700">{section.intro}</p>
          )}

          {/* Desktop only: below 1024px each name travels with its own
              portrait in the figcaption, so repeating the list here would
              say everything twice. */}
          <div className="team-stack mt-10 hidden flex-col gap-7 lg:mt-12 lg:flex lg:gap-0">
            {section.members.map((member) => (
              <div key={member.name} data-stacked className="team-label">
                <p className="font-display text-[clamp(2rem,4.8vw,4rem)] leading-[0.95] font-extrabold tracking-[-0.05em]">
                  {member.name}
                </p>
                <p className="meta mt-4 text-paper-500">{member.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* the half that moves. Two across on a tablet — in one column a
            portrait is taller than the screen there. */}
        <ul className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-1 lg:gap-10">
          {section.members.map((member, i) => (
            <li
              key={member.name}
              className={i % 2 === 0 ? "lg:pr-12" : "lg:translate-y-8 lg:pl-12"}
            >
              <figure className="team-card relative aspect-4/5 overflow-hidden bg-paper-200">
                {member.photo !== undefined && (
                  // 16% taller than the opening and hung 8% above it, so the
                  // ±6% of drift never exposes the backing
                  <div className="team-photo absolute inset-x-0 -top-[8%] h-[116%]">
                    <Image
                      src={member.photo.src}
                      alt={member.photo.alt}
                      fill
                      sizes="(max-width: 1024px) 90vw, 45vw"
                      className="object-cover object-[center_15%] mix-blend-multiply"
                      loading="lazy"
                    />
                  </div>
                )}
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/95 via-ink-900/55 to-transparent p-5 pt-16 text-paper-100 lg:hidden">
                  <p className="font-display text-2xl leading-tight font-extrabold tracking-[-0.04em]">
                    {member.name}
                  </p>
                  <p className="mt-2 text-xs font-medium tracking-[0.07em] uppercase text-paper-300">
                    {member.role}
                  </p>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
