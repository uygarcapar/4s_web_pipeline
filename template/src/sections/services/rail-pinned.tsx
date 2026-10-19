"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { lateralRail, motionAllowed } from "@/lib/motion";
import type { ServicesSection, SiteConfig } from "@/lib/schema";

/**
 * Services archetype: a pinned rail. Vertical input, horizontal travel — the
 * lateral move the design rules recommend (§3).
 *
 * Below 1024px it degrades to a native swipe list: no pin, no hijack, same
 * content in the same order. Taking over scroll on a touch device is a
 * different and worse experience than doing it with a wheel.
 *
 * `scroll-px` matters more than it looks: without it, snapping the first card
 * flush to the container edge scrolls the list's own left padding out of
 * view, and the index number sits half off-screen.
 */
export function ServicesRailPinned({
  section,
}: {
  section: ServicesSection;
  config: SiteConfig;
}) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        if (!root.current || !track.current) return;
        lateralRail({
          trigger: root.current,
          track: track.current,
          photos: ".service-photo",
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
      className="relative overflow-hidden bg-ink-900 py-20 text-paper-100 lg:h-svh lg:py-0"
    >
      <div className="flex h-full flex-col justify-center gap-12">
        <div className="flex items-end justify-between gap-6 px-5 sm:px-8">
          <h2 id={`${section.id}-title`} className="t-h2">
            {section.title}
          </h2>
          {motionAllowed() && (
            <p className="meta hidden shrink-0 text-paper-400 lg:block">
              Kaydırmaya devam edin
            </p>
          )}
        </div>

        <ul
          ref={track}
          data-rail
          className="flex snap-x snap-mandatory gap-5 scroll-px-5 overflow-x-auto px-5 pb-4 sm:scroll-px-8 sm:px-8 lg:w-max lg:overflow-visible lg:pb-0"
        >
          {section.items.map((item, i) => (
            <li
              key={item.title}
              className="w-[78vw] shrink-0 snap-start sm:w-[55vw] lg:w-[36vw]"
            >
              <article className="flex h-full flex-col">
                {item.image !== undefined && (
                  <div className="relative aspect-4/3 overflow-hidden bg-ink-800">
                    <div className="service-photo relative h-full w-[116%]">
                      <Image
                        src={item.image.src}
                        // decorative: the heading beside it carries the meaning
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 80vw, 40vw"
                        className="object-cover"
                        loading={i < 2 ? "eager" : "lazy"}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-baseline gap-5 pt-6">
                  <span className="meta tabular-nums text-paper-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="t-h3">{item.title}</h3>
                </div>
                <p className="t-body max-w-prose pt-4 text-paper-300">
                  {item.description}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
