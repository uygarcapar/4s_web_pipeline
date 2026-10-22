/**
 * The section types a generated site can have.
 *
 * This list used to be the key set of the D6 `ARCHETYPES` table, which also
 * carried one layout list per type. That table was a second source of truth
 * the moment the direction catalog gained its own archetype lists: two
 * lists, both claiming to say which layouts exist, and nothing but a test
 * keeping them in step. The directions won — a direction's whole job is to
 * narrow the library to the layouts that belong together — so what survives
 * here is only the vocabulary.
 *
 * `contact` is in the list and has one layout; `archetypes.test.ts` is what
 * stops any other type quietly falling back to the registry default.
 */
export const SECTION_TYPES = [
  "hero",
  /**
   * §9's one bold element. The only section type whose archetype is not a
   * direction's decision: it is always `custom`, the slot a model writes,
   * and `placeSignature` puts it on the page in place of `statement` when
   * the client has a sentence worth that treatment. Directions therefore do
   * not list it, and `archetypes.test.ts` exempts it for that reason rather
   * than by oversight.
   */
  "signature",
  "statement",
  "services",
  "team",
  "gallery",
  "testimonials",
  "visit",
  "faq",
  "process",
  "marquee",
  "closing",
  "contact",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}
