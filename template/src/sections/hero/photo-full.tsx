"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { resolveCtaHref } from "@/lib/cta";
import { formatPhoneTR, telHref } from "@/lib/format";
import { heroEntrance, motionAllowed, pinnedHandoff, splitChars } from "@/lib/motion";
import type { HeroSection, SiteConfig } from "@/lib/schema";

/**
 * Hero archetype: the business's own photograph full bleed, with everything
 * set straight on it — no paper panel in between.
 *
 * A photograph of a real interior is usually bright, so it carries a dark
 * scrim rather than a light one: that keeps Turkish text readable without
 * covering the picture. Three layers, because one flat tint either washes the
 * photograph out or leaves the corners where the text sits unreadable.
 *
 * On scroll the section pins and hands off: the words spread apart and leave,
 * the scrim deepens, the photograph pushes in, and the subheadline is left
 * standing in their place.
 */
export function HeroPhotoFull({
  section,
  config,
}: {
  section: HeroSection;
  config: SiteConfig;
}) {
  const root = useRef<HTMLElement>(null);
  const lines = section.headline.split(/\s+/).filter(Boolean);

  useGSAP(
    () => {
      if (!motionAllowed()) {
        gsap.set(".hero-caption", { opacity: 1 });
        return;
      }
      const lineEls = gsap.utils.toArray<HTMLElement>(".hero-line", root.current);
      const chars = lineEls.map((line) => splitChars(line, "char hero-char"));

      heroEntrance({
        chars: chars.flat(),
        meta: ".hero-meta",
        photo: ".hero-photo-inner",
      });

      if (root.current) {
        pinnedHandoff({
          trigger: root.current,
          chars,
          leaving: ".hero-words",
          deepening: ".hero-deepen",
          arriving: ".hero-caption",
          photo: ".hero-photo-inner",
        });
      }
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id={section.id}
      // ink, not paper, so the fallback behind a still-loading photograph is
      // the colour the light text is written for
      className="relative h-svh overflow-hidden bg-ink-900 text-paper-100"
    >
      {section.image !== undefined && (
        <div className="absolute inset-0">
          <div className="hero-photo-inner relative h-full w-full">
            <Image
              src={section.image.src}
              alt={section.image.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_55%]"
            />
          </div>
          <div aria-hidden className="absolute inset-0 bg-ink-900/40" />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-ink-900/75 via-ink-900/10 to-ink-900/85"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-ink-900/65 via-ink-900/15 to-transparent"
          />
          <div
            aria-hidden
            className="hero-deepen absolute inset-0 bg-ink-900/55 opacity-0"
          />
        </div>
      )}

      <div className="relative flex h-full flex-col justify-between gap-6 px-5 py-5 sm:px-8 sm:py-6">
        <header className="hero-meta flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span className="font-display text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">
            {config.business.name}
          </span>
          <span className="meta text-paper-200">{config.contact.district}</span>
        </header>

        <div className="hero-words grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            {/* The statement is split per word so the pinned hand-off has
                something to spread. aria-label carries the whole sentence,
                or a screen reader runs the words together. */}
            <h1 aria-label={section.headline} className="t-display">
              {lines.map((word, i) => (
                <span key={`${word}-${i}`} className="line-mask">
                  <span className="hero-line block">{word}</span>
                </span>
              ))}
            </h1>
          </div>

          <div className="hero-meta max-w-sm lg:pb-3">
            {section.subheadline !== undefined && (
              <p className="t-lead text-paper-200">{section.subheadline}</p>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={resolveCtaHref(section.ctaPrimary, config)}
                className="btn-label inline-flex min-h-11 items-center bg-paper-50 px-7 text-ink-900 transition-colors hover:bg-accent hover:text-paper-50 focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:outline-none"
              >
                {section.ctaPrimary.label}
              </a>
              {section.ctaSecondary !== undefined && (
                <a
                  href={resolveCtaHref(section.ctaSecondary, config)}
                  className="btn-label inline-flex min-h-11 items-center border border-paper-100/70 px-7 transition-colors hover:border-paper-50 hover:bg-paper-50 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:outline-none"
                >
                  {section.ctaSecondary.label}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* What the award references leave out of the first screen and an SMB
            site cannot: when they are open, where they are, a pressable
            number (design-rules.md §8). Normal letter-spacing — wide tracking
            belongs to standalone eyebrows, not a dense row of pairs. */}
        <dl className="hero-meta flex flex-wrap items-baseline gap-x-8 gap-y-1 border-t border-paper-100/25 pt-4 text-[0.8125rem] sm:gap-x-12">
          <HeroFact label="Adres" value={config.contact.address} />
          <div className="flex items-baseline gap-2.5">
            <dt className="text-[0.6875rem] text-paper-300 uppercase">Telefon</dt>
            <dd>
              {/* -my cancels the padding for layout, so the row keeps its
                  height while the tap area reaches 44px */}
              <a
                href={telHref(config.contact.phoneE164)}
                className="-my-3 inline-flex min-h-11 items-center font-medium tabular-nums underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
              >
                {formatPhoneTR(config.contact.phoneE164)}
              </a>
            </dd>
          </div>
        </dl>

        <p
          data-stacked
          className="hero-caption pointer-events-none absolute inset-x-5 top-1/2 max-w-3xl -translate-y-1/2 font-display text-[clamp(1.5rem,3.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.03em] text-paper-100 opacity-0 sm:inset-x-8"
        >
          {section.subheadline ?? config.business.name}
        </p>
      </div>
    </section>
  );
}

function HeroFact({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2.5">
      <dt className="text-[0.6875rem] text-paper-300 uppercase">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
