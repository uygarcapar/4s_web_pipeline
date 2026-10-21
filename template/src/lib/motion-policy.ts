import type { SiteConfig } from "@/lib/schema";

/**
 * What a direction's motion flags mean for the components that read them.
 *
 * Pure, so the decisions are testable without a browser and so the same
 * answer reaches `layout.tsx` (a server component) and a hero archetype (a
 * client one). The alternative — each component checking
 * `config.motion.something` inline — is how a flag ends up honoured in one
 * place and ignored in another, which is K8 in miniature.
 *
 * `prefers-reduced-motion` is NOT handled here. That is a per-visitor
 * runtime condition enforced by `gsap.matchMedia` in `src/lib/motion.ts`,
 * and conflating it with a per-site build-time decision would make a calm
 * direction and a reduced-motion visitor indistinguishable in the code.
 */

/** Does this site mount Lenis at all? */
export function usesSmoothScroll(config: SiteConfig): boolean {
  return config.motion.smoothScroll;
}

/** Does the hero animate on page load? */
export function usesHeroEntrance(config: SiteConfig): boolean {
  return config.motion.heroEntrance;
}

/**
 * Does this site's profile permit scroll-driven devices — a pinned
 * hand-off, a lateral rail, a text transformation?
 *
 * `still` and `calm` do not. An archetype that pins regardless is the other
 * half of K8: DJ10 checks that nothing a direction disables is present, so
 * the page fails a check nobody can fix by editing the direction.
 */
export function usesScrollChoreography(config: SiteConfig): boolean {
  const { profile } = config.motion;
  return profile === "editorial" || profile === "kinetic";
}
