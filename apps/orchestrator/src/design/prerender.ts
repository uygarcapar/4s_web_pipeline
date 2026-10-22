import type { DesignSpec, Facts } from "@pipeline/core";

/**
 * A buildable site from a spec and the client's raw crawl — no model call
 * (D10 §8.2).
 *
 * This is **not** a generated site and must never be shipped as one. It is a
 * measurement scaffold: §8.2 compares candidate specs by screenshotting
 * them, and a screenshot needs something on the page. The tokens, the
 * archetypes and the photographs are exactly what the real site will use,
 * which is what makes the comparison meaningful; the copy is the client's
 * own raw text, unedited, because editing it is the generate stage's job
 * and a model call is precisely what §8.2 exists to avoid paying for.
 *
 * The verbatim rule still holds, and harder than usual: nothing here may
 * invent an hour, a price, a phone number or a service. Where a required
 * field has no source, the fallback is either another piece of the client's
 * own text or an obviously-synthetic marker — never a plausible sentence.
 * A plausible sentence in a measurement artifact is a sentence that can be
 * mistaken for a fact later.
 */

export interface ContentBlock {
  tag?: string;
  text?: string;
}

export interface ContentPage {
  url?: string | null;
  slug?: string | null;
  title?: string | null;
  h1?: string | null;
  contentBlocks?: ContentBlock[];
}

export interface CrawlContent {
  pages?: ContentPage[];
  faq?: { question?: string; answer?: string }[];
  headings?: { text?: string; level?: number }[];
  services?: { name?: string; description?: string }[];
}

export interface CrawlImage {
  /** Path under the site's public/, e.g. "/images/crawl/3-image.jpg". */
  src: string;
}

/**
 * The marker used where the client's own text ran out.
 *
 * Deliberately not prose. A pre-render whose placeholder reads like a
 * sentence is one somebody will eventually screenshot into a review and
 * read as the client's words.
 */
export const PLACEHOLDER = "—";

const CTA_LABEL = "Ara";

export interface PrerenderInput {
  facts: Facts;
  content: CrawlContent | null;
  spec: DesignSpec;
  images: CrawlImage[];
}

/**
 * Build the `SiteConfig` object a candidate renders from.
 *
 * Returned untyped-by-the-template on purpose: the orchestrator cannot
 * import `template/src/lib/schema.ts` (separate tsconfig, separate app), so
 * the shape is kept in step the only way available — the template parses it
 * with `siteConfigSchema` at build time, and a drift fails the pre-render
 * build loudly rather than rendering something half-right.
 */
export function prerenderConfig(input: PrerenderInput): Record<string, unknown> {
  const { facts, content, spec, images } = input;
  const text = rawText(content);

  return {
    business: {
      name: facts.businessName,
      legalName: facts.legalName,
      // The client's own first heading if they wrote one, their name if not.
      // Never a slogan we composed — that is the generate stage's decision
      // and §9's rules apply to it.
      slogan: firstHeading(content) ?? facts.businessName,
    },
    businessType: "LocalBusiness",
    contact: {
      phoneE164: facts.phoneE164 ?? "+905000000000",
      whatsappE164: facts.whatsappE164,
      email: facts.email ?? "ornek@example.com",
      address: facts.address ?? PLACEHOLDER,
      district: facts.district ?? PLACEHOLDER,
      city: facts.city ?? PLACEHOLDER,
      mapsEmbedQuery: facts.mapsEmbedQuery ?? facts.businessName,
    },
    openingHours: facts.openingHours,
    hoursNote: facts.hoursNote,
    socialLinks: facts.socialLinks,
    brand: {
      hue: spec.color.brandH,
      chroma: Math.min(spec.color.brandC, 0.37),
      // Carried for the schema's sake; the real faces come from the
      // generated fonts.ts, which the pre-render copies in alongside
      // tokens.css exactly as the generate stage does.
      fontHeading: spec.type.display,
      fontBody: spec.type.body,
    },
    seo: {
      title: facts.businessName,
      description: text[0] ?? facts.businessName,
    },
    kvkk: {
      // The legal identity the client publishes, or their trading name.
      // Never a constructed "X Ltd. Şti." — the whole point of the field is
      // that it names a real controller.
      companyTitle: facts.legalName ?? facts.businessName,
      dataController: facts.legalName ?? facts.businessName,
    },
    sellsOnline: false,
    /**
     * The direction's motion flags. **Load-bearing for the measurement**,
     * not boilerplate: `motion` defaults to the pre-D10 kinetic language if
     * absent, so a `quiet-luxury` candidate would render with a hero
     * entrance and smooth scroll it explicitly disables — and §8.2 would be
     * comparing screenshots of a page no client will ever get.
     */
    motion: {
      profile: spec.motion.profile,
      heroEntrance: spec.motion.heroEntrance,
      smoothScroll: spec.motion.smoothScroll,
    },
    sections: spec.sections
      .map((section, index) =>
        buildSection({ section, index, facts, content, images, text }),
      )
      .filter((s): s is Record<string, unknown> => s !== null),
  };
}

interface SectionInput {
  section: { type: string; archetype: string };
  index: number;
  facts: Facts;
  content: CrawlContent | null;
  images: CrawlImage[];
  text: string[];
}

function buildSection(input: SectionInput): Record<string, unknown> | null {
  const { section, index, facts, content, images, text } = input;
  const id = section.type;
  const variant = section.archetype === "default" ? undefined : section.archetype;
  const base = { id, type: section.type, ...(variant ? { variant } : {}) };
  // `ctaSchema` is `{ label, action, href? }`: the href is derived from
  // `config.contact` by `telHref`, so a CTA never carries a number of its
  // own and cannot contradict the facts.
  const call = { label: CTA_LABEL, action: "tel" as const };

  switch (section.type) {
    case "hero":
      return {
        ...base,
        headline: text[0] ?? facts.businessName,
        subheadline: text[1] ?? facts.businessName,
        ctaPrimary: call,
        ...(images[0] ? { image: image(images[0], facts) } : {}),
      };

    case "statement": {
      // `text` is `min(40)`: a statement is a sentence, not a label. If the
      // client never wrote one that long, the section is absent rather than
      // padded — padding it would put our words in their voice.
      const sentence = longest(text);
      return sentence === null ? null : { ...base, text: sentence };
    }

    case "services": {
      const items = serviceItems(facts, content, images);
      return items.length === 0 ? null : { ...base, title: "Hizmetler", items };
    }

    case "team": {
      // The crawl gives people as pages, not as structured members, and
      // inventing a role for a named person is exactly the kind of
      // invention D8 forbids. Names only, roles marked absent.
      const people = personPages(content).slice(0, 6);
      return people.length === 0
        ? null
        : {
            ...base,
            title: "Ekibimiz",
            members: people.map((name, i) => ({
              name,
              role: PLACEHOLDER,
              ...(images[i + 1] ? { photo: image(images[i + 1]!, facts) } : {}),
            })),
          };
    }

    case "gallery":
      return images.length < 2
        ? null
        : {
            ...base,
            title: "Galeri",
            images: images.slice(0, 8).map((img) => image(img, facts)),
          };

    case "testimonials": {
      // Never synthesised. A fabricated review is the one placeholder that
      // would be actively harmful if it ever escaped the scaffold.
      return null;
    }

    case "visit":
      // `{ id, type, variant, title }` and strict: the address, the hours
      // and the number all come from `config.contact` and
      // `config.openingHours`, so this section states no fact of its own.
      return facts.openingHours.length === 0 && facts.hoursNote === null
        ? null
        : { ...base, title: "Ziyaret" };

    case "faq": {
      const pairs = (content?.faq ?? [])
        .filter((f) => typeof f.question === "string" && typeof f.answer === "string")
        .slice(0, 8)
        .map((f) => ({ question: f.question!, answer: f.answer! }));
      return pairs.length < 2 ? null : { ...base, title: "Sık Sorulanlar", items: pairs };
    }

    case "process": {
      // §9 forbids inventing a process, and the crawl cannot tell one from
      // a list of services. A pre-render has no business guessing.
      return null;
    }

    case "marquee": {
      const phrases = (facts.services.length > 0 ? facts.services : text).slice(0, 6);
      return phrases.length < 3 ? null : { ...base, items: phrases };
    }

    case "closing":
      return {
        ...base,
        headline: text[0] ?? facts.businessName,
        ctaPrimary: call,
      };

    case "contact":
      // Also strict, and also fact-free: it renders `config.contact`.
      // `showForm` is false because the form is a mailto fallback and a
      // scaffold has nobody to mail.
      return { ...base, title: "İletişim", showForm: false };

    default:
      // A section type the pre-render does not know how to fill is skipped
      // rather than approximated. It costs one section's worth of signal in
      // the screenshot; approximating it would cost the comparison's
      // meaning, since the shape would be ours and not the direction's.
      void index;
      return null;
  }
}

function image(img: CrawlImage, facts: Facts): Record<string, unknown> {
  // `imageSchema` is `{ src, alt }` and strict — dimensions belong to
  // next/image, which reads them off the file.
  //
  // The crawl does not carry alt text and writing one is a copy decision.
  // The business name is the only true thing available, and the scaffold is
  // never read by a screen reader.
  return { src: img.src, alt: facts.businessName };
}

function serviceItems(
  facts: Facts,
  content: CrawlContent | null,
  images: CrawlImage[],
): Record<string, unknown>[] {
  const fromContent = (content?.services ?? [])
    .filter((s): s is { name: string; description?: string } => typeof s.name === "string")
    .map((s, i) => ({
      title: s.name,
      // The crawl's own description if it found one; the service's name
      // repeated if not. Repeating is visibly wrong in a screenshot, which
      // is the point — it cannot be mistaken for copy.
      description: s.description ?? s.name,
      ...(images[i] ? { image: image(images[i]!, facts) } : {}),
    }));
  if (fromContent.length > 0) return fromContent.slice(0, 12);

  return facts.services
    .slice(0, 12)
    .map((name, i) => ({
      title: name,
      description: name,
      ...(images[i] ? { image: image(images[i]!, facts) } : {}),
    }));
}

/** Every content block's text, longest-page-first, deduplicated. */
function rawText(content: CrawlContent | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const page of content?.pages ?? []) {
    for (const block of page.contentBlocks ?? []) {
      const text = block.text?.trim();
      if (!text || text.length < 8 || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

function firstHeading(content: CrawlContent | null): string | null {
  const heading = (content?.headings ?? []).find(
    (h) => typeof h.text === "string" && h.text.trim().length > 0,
  );
  return heading?.text?.trim() ?? null;
}

const STATEMENT_MIN = 40;
const STATEMENT_MAX = 320;

function longest(text: string[]): string | null {
  let best: string | null = null;
  for (const t of text) {
    // A statement is a sentence about the business, so the longest block
    // under a readable length beats the longest overall — which is usually
    // a navigation dump or a cookie notice. The floor is the schema's.
    if (t.length < STATEMENT_MIN || t.length > STATEMENT_MAX) continue;
    if (best === null || t.length > best.length) best = t;
  }
  return best;
}

/** Page titles that name a person, from the same slug rules the inventory uses. */
function personPages(content: CrawlContent | null): string[] {
  const out: string[] = [];
  for (const page of content?.pages ?? []) {
    const slug = (page.slug ?? page.url ?? "").toLocaleLowerCase("en-US");
    if (!/\b(dt-|dr-|doktor|hekim|uzman|ekip|kadro)/.test(slug)) continue;
    const name = page.h1?.trim() ?? page.title?.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}
