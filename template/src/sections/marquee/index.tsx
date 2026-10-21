"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { usesScrollChoreography } from "@/lib/motion-policy";
import type { MarqueeSection, SiteConfig } from "@/lib/schema";

/**
 * A band of the client's own short phrases running across the page.
 *
 * **Motion profiles.** The band only moves under `editorial` and `kinetic`.
 * Under `still` and `calm` the same items render as a static row — the
 * direction declares a quiet page, and a permanently moving band is the
 * loudest thing on any page it appears on. That is the §7.2 requirement that
 * an archetype declare which profiles it supports rather than assume all
 * four.
 *
 * **Reduced motion.** `gsap.matchMedia` gates the tween, and the items are
 * at their natural position with no transform applied, so nothing is hidden
 * when it does not run. The duplicate half is `aria-hidden`, so a screen
 * reader hears the list once.
 *
 * **Touch.** Nothing here listens to scroll or pointer events; it is a
 * self-running tween on `x`. design-rules.md §3 bans hijacking touch, and a
 * marquee that scrubs with the scroll position is exactly that.
 *
 * Generic cluster 5 (design-rules.md §2) fails a marquee of `A · B · C` with
 * nothing behind it. `items` are the client's own words — service names, the
 * districts they serve — which the schema enforces by requiring at least
 * three and the plan stage enforces by quoting the crawl.
 */
export function Marquee({
  section,
  config,
}: {
  section: MarqueeSection;
  config: SiteConfig;
}) {
  const root = useRef<HTMLElement>(null);
  const moves = usesScrollChoreography(config);

  useGSAP(
    () => {
      if (!moves) return;
      const mm = gsap.matchMedia();
      let observer: IntersectionObserver | undefined;

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Translating by exactly half the track, which holds two identical
        // halves, makes the loop seamless: at -50% the second half sits
        // where the first began.
        const tween = gsap.to(".marquee-track", {
          xPercent: -50,
          ease: "none",
          duration: Math.max(18, section.items.length * 3.5),
          repeat: -1,
        });

        // Only run while the band is on screen. Two reasons, and the second
        // is the one that bites: a tween that never stops burns a rAF frame
        // on every client site forever, and it also leaves the visual gate
        // comparing a moving target. The screenshot tolerance absorbs it
        // today, but "a check that produces false positives is worse than no
        // check" (design-rules.md §12) is not a thing to rely on luck for.
        if (root.current !== null) {
          observer = new IntersectionObserver(
            ([entry]) => {
              if (entry?.isIntersecting === true) tween.play();
              else tween.pause();
            },
            { rootMargin: "100px" },
          );
          observer.observe(root.current);
        }

        return () => {
          observer?.disconnect();
          tween.kill();
        };
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [moves, section.items.length] },
  );

  const items = section.items;

  return (
    <section
      ref={root}
      id={section.id}
      aria-label={items.join(", ")}
      className="overflow-hidden border-y bg-[var(--paper-200)] py-6"
      style={{
        borderTopWidth: "var(--rule-width)",
        borderBottomWidth: "var(--rule-width)",
        borderColor: "var(--rule-color)",
      }}
    >
      <div
        className={
          moves
            ? "marquee-track flex w-max items-center gap-10"
            : // Static: wrap instead of running off the edge, and centre the
              // row so a short list does not sit oddly left under a
              // `centered` direction.
              "flex flex-wrap items-center justify-center gap-x-10 gap-y-3"
        }
      >
        {items.map((item, i) => (
          <span key={`a-${i}`} className="meta shrink-0 text-[var(--ink-700)]">
            {item}
          </span>
        ))}
        {/* The second half exists only to make the loop seamless. */}
        {moves &&
          items.map((item, i) => (
            <span
              key={`b-${i}`}
              aria-hidden="true"
              className="meta shrink-0 text-[var(--ink-700)]"
            >
              {item}
            </span>
          ))}
      </div>
    </section>
  );
}
