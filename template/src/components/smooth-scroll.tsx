"use client";

import { type ReactNode, useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * The motion foundation every generated site shares (design-rules.md §3):
 * Lenis smooth scroll driven by gsap.ticker, so ScrollTrigger reads the same
 * clock as the scroll position.
 *
 * Four things here are not optional, each of them a bug we already shipped
 * once:
 *
 *  - Reduced motion is the first branch. No Lenis, no ticker, native scroll.
 *  - Scroll restoration is ours. The browser restores the old offset on
 *    reload and ScrollTrigger separately restores its own, while the page's
 *    height is still being decided by pins that have not been measured — so
 *    a reload lands in the middle of a pinned section, somewhere different
 *    every time.
 *  - lenis.resize() on every ScrollTrigger refresh. Pins change the document
 *    height and Lenis caches it.
 *  - A refresh after document.fonts.ready, then re-assert the top: trigger
 *    positions measured before the webfont settles are a few pixels off, and
 *    the refresh itself can move the scroll position.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("js");

    // Both restorers, silenced. The inline script in the layout has already
    // claimed the browser's; this claims GSAP's.
    ScrollTrigger.clearScrollMemory("manual");

    const startAtTop = !window.location.hash;
    if (startAtTop) window.scrollTo(0, 0);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    if (startAtTop) lenis.scrollTo(0, { immediate: true, force: true });
    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const onRefresh = () => lenis.resize();
    ScrollTrigger.addEventListener("refresh", onRefresh);

    void document.fonts.ready.then(() => {
      ScrollTrigger.refresh();

      if (startAtTop) {
        lenis.scrollTo(0, { immediate: true, force: true });
        window.scrollTo(0, 0);
        return;
      }

      // A hash target below a pinned section cannot be reached by the
      // browser's own jump: that happens before the pins exist, and creating
      // their spacers pushes the target several viewports further down.
      const el = document.getElementById(
        decodeURIComponent(window.location.hash.slice(1)),
      );
      if (!el) return;
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      lenis.scrollTo(el.getBoundingClientRect().top + window.scrollY - margin, {
        immediate: true,
        force: true,
      });
    });

    return () => {
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

/**
 * Runs before anything paints. Must be injected as an inline script in the
 * layout, not an effect — by the time React hydrates the browser has already
 * restored the old scroll position.
 */
export const SCROLL_INIT_SCRIPT = `try{if("scrollRestoration" in history){history.scrollRestoration="manual"}if(!location.hash){window.scrollTo(0,0)}}catch(e){}`;
