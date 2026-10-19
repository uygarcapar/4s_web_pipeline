"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * The shared motion vocabulary (design-rules.md §3). Sections compose these
 * rather than writing timelines by hand, so every generated site keeps the
 * same grammar — one pinned hand-off, one text transformation — while the
 * design DNA decides which section carries which.
 *
 * Every helper is a no-op under `prefers-reduced-motion: reduce` and leaves
 * its target fully visible.
 */

export function motionAllowed(): boolean {
  return (
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Split a heading into per-character spans **on the client only**. Server-side
 * the heading stays plain words, so it still registers as one text block for
 * Largest Contentful Paint.
 *
 * Returns the created spans; callers animate those.
 */
export function splitChars(line: HTMLElement, className = "char"): HTMLElement[] {
  const text = line.textContent ?? "";
  line.textContent = "";
  const out: HTMLElement[] = [];
  for (const ch of text) {
    const span = document.createElement("span");
    span.className = `${className} inline-block`;
    span.textContent = ch === " " ? " " : ch;
    line.appendChild(span);
    out.push(span);
  }
  return out;
}

/** The single orchestrated page-load moment: the hero's words arriving. */
export function heroEntrance(input: {
  chars: HTMLElement[];
  meta: string;
  photo: string;
}): void {
  gsap
    .timeline({ defaults: { ease: "power4.out" } })
    .from(input.chars, { yPercent: 118, stagger: 0.022, duration: 1.1 })
    .from(input.meta, { opacity: 0, duration: 0.7, stagger: 0.1 }, 0.4)
    .from(input.photo, { scale: 1.16, duration: 1.6, ease: "power2.out" }, 0);
}

/**
 * The required pinned hand-off: two elements trade places over the scrub
 * while the section holds still. Not a fade.
 */
export function pinnedHandoff(input: {
  trigger: HTMLElement;
  /** Character spans to spread apart as the statement leaves. */
  chars: HTMLElement[][];
  /** Selector for the block that leaves. */
  leaving: string;
  /** Selector for the scrim that deepens as the photograph takes over. */
  deepening?: string;
  /** Selector for the line left standing in their place. */
  arriving?: string;
  /** Selector for the photograph that pushes in. */
  photo?: string;
}): void {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: input.trigger,
      start: "top top",
      end: "+=150%",
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  const spread = Math.min(window.innerWidth * 0.05, 110);
  for (const line of input.chars) {
    const mid = (line.length - 1) / 2;
    line.forEach((char, i) => {
      tl.to(char, { x: (i - mid) * spread * 0.4, ease: "none" }, 0);
    });
  }

  tl.to(input.leaving, { opacity: 0, ease: "none" }, 0.3);
  if (input.photo) tl.to(input.photo, { scale: 1.12, ease: "none" }, 0);
  if (input.deepening) tl.to(input.deepening, { opacity: 1, ease: "none" }, 0);
  if (input.arriving) tl.to(input.arriving, { opacity: 1, ease: "none" }, 0.55);
}

/**
 * The required text transformation, shape one: a sentence that lights up word
 * by word as it is scrolled through. The text changes rather than moving.
 */
export function wordByWord(input: { trigger: HTMLElement; words: string }): void {
  gsap.fromTo(
    input.words,
    { opacity: 0.17 },
    {
      opacity: 1,
      ease: "none",
      stagger: 0.5,
      scrollTrigger: {
        trigger: input.trigger,
        start: "top 78%",
        end: "bottom 55%",
        scrub: 0.5,
      },
    },
  );
}

/**
 * The required text transformation, shape two: a label that swaps in place as
 * each subject passes the middle of the screen.
 *
 * One source of truth for which label is lit. Neighbouring triggers overlap,
 * and letting each one tween the shared target leaves two labels stacked on
 * top of each other — a bug we shipped once already.
 */
export function swapInPlace(input: { cards: HTMLElement[]; labels: HTMLElement[] }): void {
  let active = -1;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    input.labels.forEach((label, j) => {
      gsap.to(label, { autoAlpha: j === i ? 1 : 0, duration: 0.35, overwrite: true });
    });
  };

  input.cards.forEach((card, i) => {
    ScrollTrigger.create({
      trigger: card,
      start: "top 60%",
      end: "bottom 40%",
      onEnter: () => setActive(i),
      onEnterBack: () => setActive(i),
    });
  });

  gsap.set(input.labels.slice(1), { autoAlpha: 0 });
  active = 0;
}

/**
 * The recommended lateral move: vertical input, horizontal travel. The pin
 * lasts exactly as long as the distance, so the rail tracks the wheel.
 */
export function lateralRail(input: { trigger: HTMLElement; track: HTMLElement; photos?: string }): void {
  const distance = () => input.track.scrollWidth - window.innerWidth;
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: input.trigger,
      start: "top top",
      end: () => `+=${distance()}`,
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  tl.to(input.track, { x: () => -distance(), ease: "none" });
  if (input.photos) {
    for (const el of gsap.utils.toArray<HTMLElement>(input.photos)) {
      tl.fromTo(el, { xPercent: -8 }, { xPercent: 8, ease: "none" }, 0);
    }
  }
}

/** Supporting texture only — never a page's entire motion vocabulary. */
export function riseIn(input: { trigger: HTMLElement | string; targets: string; stagger?: number }): void {
  gsap.from(input.targets, {
    y: 26,
    autoAlpha: 0,
    stagger: input.stagger ?? 0.08,
    duration: 0.8,
    ease: "power3.out",
    scrollTrigger: { trigger: input.trigger, start: "top 85%" },
  });
}

/** A photograph drifting inside a frame taller than its opening. */
export function parallaxInFrame(input: { card: HTMLElement; photo: Element | null }): void {
  if (!input.photo) return;
  gsap.fromTo(
    input.photo,
    { yPercent: -6 },
    {
      yPercent: 6,
      ease: "none",
      scrollTrigger: { trigger: input.card, start: "top bottom", end: "bottom top", scrub: true },
    },
  );
}
