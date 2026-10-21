"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * The second site's choreography leans on the corpus devices the first one
 * left alone: parallax (31/56) and scale (17/56), plus a card stack — the
 * commonest way a pin is actually spent on these sites, with each sheet
 * holding while the next slides over it.
 *
 * Site one spent its pin on a wipe and a lateral rail. Same measurements,
 * different selection; that is how two sites from one corpus stay unalike.
 */
export function Motion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /* Masthead: the rule under the title draws itself, and the title
           settles back to 1 as the page takes over. Scale, not translation —
           the word stays where it was written. */
        const head = root.current?.querySelector<HTMLElement>("[data-head]");
        if (head) {
          gsap
            .timeline({
              scrollTrigger: {
                trigger: head,
                start: "top top",
                end: "+=900",
                pin: true,
                scrub: true,
                anticipatePin: 1,
              },
            })
            .fromTo(
              head.querySelector("[data-rule]"),
              { scaleX: 0 },
              { scaleX: 1, ease: "none", transformOrigin: "left center" },
            )
            .to(head.querySelector("[data-title]"), { scale: 0.86, ease: "none" }, "<")
            .to(head.querySelector("[data-sub]"), { autoAlpha: 0.25, ease: "none" }, "<");
        }

        /* Depth: three bands drifting at different rates. The corpus median
           parallax site moves one element; the heavy users move dozens. Three
           is deliberately the quiet end. */
        for (const layer of gsap.utils.toArray<HTMLElement>("[data-depth]")) {
          const rate = Number(layer.dataset.depth ?? "10");
          gsap.to(layer, {
            yPercent: -rate,
            ease: "none",
            scrollTrigger: {
              trigger: layer.closest("section"),
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          });
        }

        /* The stack: each sheet pins in turn and the next rides over it.
           Nothing is hidden — a sheet that has been covered is still in the
           document, and reduced motion simply leaves them as a column. */
        const sheets = gsap.utils.toArray<HTMLElement>("[data-stack] .stack-item");
        sheets.forEach((sheet, i) => {
          if (i === sheets.length - 1) return;
          gsap.to(sheet, {
            scale: 0.94,
            yPercent: -4,
            ease: "none",
            scrollTrigger: {
              trigger: sheet,
              start: "top 10%",
              end: () => "+=" + (sheets[i + 1]?.offsetHeight ?? 600),
              scrub: true,
            },
          });
        });

        /* Figures count as their row arrives. Discrete, so it eases. */
        for (const fig of gsap.utils.toArray<HTMLElement>("[data-count]")) {
          const to = Number(fig.dataset.count ?? "0");
          const obj = { v: 0 };
          gsap.to(obj, {
            v: to,
            duration: 0.9,
            ease: "expo.out",
            scrollTrigger: { trigger: fig, start: "top 85%" },
            onStart: () => {
              fig.textContent = "0";
            },
            onUpdate: () => {
              fig.textContent = String(Math.round(obj.v));
            },
          });
        }
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
