"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll choreography, built to what the corpus measured rather than to taste.
 *
 *   pin     34/56 sites, median 6 elements  — the dominant device
 *   filter  46/57 sites tween it            — we had never used it
 *   clip    13/56                           — wipes, not fades
 *   scrub   `ease: "none"` is the most common literal in the mined bundles
 *
 * Every timeline sits behind `gsap.matchMedia`, and every element a timeline
 * would reveal starts visible in CSS, so a reduced-motion visitor loses the
 * motion and keeps the page.
 */

/** Scroll drives the whole page: one pin per act, each handing to the next. */
export function Choreography({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /* ACT 1 — the opening statement is pinned, then wiped away by a
           clip-path rather than faded, and pushed back with a blur so the
           next act arrives in front of it instead of on top of it. */
        const act1 = root.current?.querySelector<HTMLElement>("[data-act='open']");
        if (act1) {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: act1,
                start: "top top",
                end: "+=1600",
                pin: true,
                scrub: true,
                anticipatePin: 1,
              },
            })
            .to(act1.querySelectorAll("[data-line]"), {
              yPercent: -110,
              stagger: 0.12,
              ease: "none",
            })
            .fromTo(
              act1.querySelector("[data-plate]"),
              { clipPath: "inset(100% 0% 0% 0%)" },
              { clipPath: "inset(0% 0% 0% 0%)", ease: "none" },
              "<",
            )
            .to(act1, { filter: "blur(14px)", scale: 0.94, ease: "none" }, ">-0.2");
        }

        /* ACT 2 — the sentence itself changes. One word is swapped for the
           next as the pin scrubs: the text transforms, it does not travel. */
        const act2 = root.current?.querySelector<HTMLElement>("[data-act='swap']");
        if (act2) {
          const words = gsap.utils.toArray<HTMLElement>("[data-swap]", act2);
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: act2,
              start: "top top",
              end: "+=" + words.length * 520,
              pin: true,
              scrub: true,
              anticipatePin: 1,
            },
          });
          words.forEach((w, i) => {
            if (i === 0) return;
            tl.set(words[i - 1]!, { autoAlpha: 0, position: "absolute" })
              .fromTo(
                w,
                { autoAlpha: 0, yPercent: 60, filter: "blur(10px)" },
                { autoAlpha: 1, yPercent: 0, filter: "blur(0px)", ease: "none" },
                "<",
              );
          });
        }

        /* ACT 3 — vertical input, lateral travel. The rail is laid out wider
           than the viewport and the pin translates it; 15/56 sites move
           laterally, so this is the minority device used once, on purpose. */
        const act3 = root.current?.querySelector<HTMLElement>("[data-act='travel']");
        const track = act3?.querySelector<HTMLElement>("[data-track]");
        if (act3 && track) {
          gsap.to(track, {
            x: () => -(track.scrollWidth - window.innerWidth + 64),
            ease: "none",
            scrollTrigger: {
              trigger: act3,
              start: "top top",
              end: () => "+=" + (track.scrollWidth - window.innerWidth + 64),
              pin: true,
              scrub: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });
          // Depth: the cards' own photographs drift against the travel.
          gsap.to("[data-depth]", {
            xPercent: 12,
            ease: "none",
            scrollTrigger: { trigger: act3, start: "top top", end: "bottom top", scrub: true },
          });
        }

        /* ACT 4 — focus. The corpus tweens `filter` on 46 of 57 sites; this
           is the one place it earns its keep, pulling a blurred block sharp
           as it reaches the middle of the screen. */
        for (const el of gsap.utils.toArray<HTMLElement>("[data-focus]")) {
          gsap.fromTo(
            el,
            { filter: "blur(12px)", opacity: 0.35 },
            {
              filter: "blur(0px)",
              opacity: 1,
              ease: "none",
              scrollTrigger: { trigger: el, start: "top 90%", end: "top 45%", scrub: true },
            },
          );
        }

        /* Closing — a wipe, matching the opening so the page book-ends. */
        for (const el of gsap.utils.toArray<HTMLElement>("[data-wipe]")) {
          gsap.fromTo(
            el,
            { clipPath: "inset(0% 0% 100% 0%)" },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              ease: "expo.out",
              duration: 0.4,
              scrollTrigger: { trigger: el, start: "top 85%" },
            },
          );
        }
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
