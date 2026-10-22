import type { SignatureSection, SiteConfig } from "@/lib/schema";

import { Signature } from "./index";

/**
 * **The free component slot** (D10 §9) — the only file in the template a
 * model may write from scratch.
 *
 * It ships re-exporting the default so the registry always has something to
 * import and the template builds on its own. The signature stage overwrites
 * this file, builds, screenshots, critiques the result against the
 * direction's reference screenshots, and revises — up to three rounds. If
 * none of them converge the stage restores this file and drops the section's
 * `variant`, so the page falls back to `Signature` and the run continues.
 * §9 is explicit that taste alone never blocks a run.
 *
 * The freedom is real but bounded, and the bounds are the same ones every
 * other section has:
 *
 * - **Content comes from `section` and `config`, never from the component.**
 *   A bespoke shape cannot invent an hour, a price or a sentence.
 * - **Colour comes from the tokens.** No hex, no `text-white`; the ramp is
 *   the direction's and the contrast gate has already checked it.
 * - **Type comes from the eight steps.** A size invented here is a size
 *   outside the scale the rest of the page is built on.
 * - It renders through `registry.ts` like everything else (build-rules §4),
 *   which is why this is a slot and not an escape hatch into the page.
 */
export function SignatureCustom({
  section,
  config,
}: {
  section: SignatureSection;
  config: SiteConfig;
}) {
  return <Signature section={section} config={config} />;
}
