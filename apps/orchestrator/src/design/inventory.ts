import { foldForMatch } from "./fold.js";

/**
 * What the crawl actually found, read from the shape the crawl actually
 * produces.
 *
 * The first version of this looked for `content.services` and `content.team`
 * and found neither, so a clinic with ten treatment pages and five doctors
 * came out as a four-section site. The crawl does not label pages by role —
 * it gives us slugs, titles and content blocks — so the roles are inferred
 * from those, which is both more reliable and the only thing that generalises
 * to a bakery or a law firm.
 */

export interface CrawlPage {
  url?: string;
  slug?: string;
  title?: string;
  h1?: unknown;
  contentBlocks?: unknown[];
}

export interface Inventory {
  contentBlocks: number;
  services: CrawlPage[];
  /** Individual services described on the site, independent of page count. */
  serviceItems: number;
  team: CrawlPage[];
  posts: CrawlPage[];
  faq: number;
  photos: number;
  hours: number;
  hasServices: boolean;
  hasTeam: boolean;
  hasFaq: boolean;
  hasGallery: boolean;
  hasTestimonials: boolean;
  hasHours: boolean;
}

/** Slug fragments that mark a page as describing something the business sells. */
const SERVICE_SLUGS = [
  "hizmet",
  "service",
  "tedavi",
  "islem",
  "urun",
  "product",
  "menu",
  "paket",
];

/** Slug fragments that mark a page as a person. */
const PERSON_SLUGS = ["dt-", "dr-", "doktor", "hekim", "uzman", "ekip", "kadro"];

/**
 * Titles that name a person. Two shapes, because Turkish clinics use both:
 * an honorific before the name ("Dt. Nesrin Topçu Yazar"), or a profession
 * before it with no abbreviation at all ("Periodontolog Ozan Burak İskefli",
 * "Ortodonti Uzmanı Merve Öztürk"). The second shape is why the capital
 * letter after the word matters — it separates "Ortodonti Uzmanı Merve" from
 * a treatment page simply titled "Ortodonti".
 */
const PERSON_HONORIFIC = /\b(dt|dr|op\.?\s*dr|prof|do[çc]|uzm|av)\b\.?\s+\S/i;
const PERSON_PROFESSION = /\b(periodontolog|ortodontist|endodontist|implantolog|protez\s*uzman)/i;
const PERSON_ROLE_THEN_NAME = /\b(hekimi|uzman[ıi]|doktoru)\s+\p{Lu}/u;

/** Pages that are about getting in touch, not about what is on offer. */
const BOOKING_SLUGS = ["randevu", "appointment", "rezervasyon", "iletisim", "contact", "bize-ulas"];

const POST_SLUGS = ["post-", "blog-", "makale", "haber", "yazi"];

const TESTIMONIAL_SLUGS = ["yorum", "referans", "testimonial", "memnun", "gorus"];

function slugOf(page: CrawlPage): string {
  return foldForMatch(page.slug ?? page.url ?? "");
}

function matches(page: CrawlPage, fragments: string[]): boolean {
  const s = slugOf(page);
  return fragments.some((f) => s.includes(f));
}

/**
 * A page is a person's page if its slug or its title says so. Both are
 * checked because sites are inconsistent: one clinic uses `/dr-merve-ozturk`,
 * another uses `/ekip/12` with "Ortodonti Uzmanı Merve Öztürk" as the title.
 */
/**
 * A services slug is the strongest signal on the page and wins over every
 * person hint. "hizmetlerimiz-cocuk-dis-hekimi" is a treatment, not a
 * dentist, even though its slug ends in "hekimi" — without this precedence
 * the clinic lost a service and gained a doctor who does not exist.
 */
function hasServiceSlug(page: CrawlPage): boolean {
  return matches(page, SERVICE_SLUGS) && !matches(page, BOOKING_SLUGS);
}

export function isPersonPage(page: CrawlPage): boolean {
  if (matches(page, POST_SLUGS)) return false; // a blog post about a doctor is not a doctor
  if (hasServiceSlug(page)) return false;
  if (matches(page, PERSON_SLUGS)) return true;
  const title = page.title ?? "";
  return (
    PERSON_HONORIFIC.test(title) ||
    PERSON_PROFESSION.test(title) ||
    PERSON_ROLE_THEN_NAME.test(title)
  );
}

export function isServicePage(page: CrawlPage): boolean {
  if (matches(page, POST_SLUGS)) return false;
  // "dis-tedavi-randevu" carries a treatment word but sells nothing — it is
  // the booking form.
  if (matches(page, BOOKING_SLUGS)) return false;
  return hasServiceSlug(page);
}

export function takeInventory(input: {
  content: { pages?: unknown; faq?: unknown; services?: unknown } | null;
  facts: Record<string, unknown>;
  /** Photographs the crawl downloaded that are large enough to show. */
  usablePhotos: number;
}): Inventory {
  const pages = asArray<CrawlPage>(input.content?.pages);
  const faq = asArray(input.content?.faq).length;
  const hours = asArray(input.facts.openingHours).length;

  const services = pages.filter(isServicePage);
  const serviceItems = asArray(input.content?.services).length;
  const team = pages.filter(isPersonPage);
  const posts = pages.filter((p) => matches(p, POST_SLUGS));
  const testimonials = pages.filter((p) => matches(p, TESTIMONIAL_SLUGS));

  const contentBlocks = pages.reduce(
    (sum, p) => sum + asArray(p.contentBlocks).length,
    0,
  );

  return {
    contentBlocks,
    services,
    serviceItems,
    team,
    posts,
    faq,
    photos: input.usablePhotos,
    hours,
    // A section exists only when there is enough behind it to be worth a
    // section: one lonely treatment page is a paragraph, not a rail. Counted
    // in services, not pages — a salon that lists twenty treatments on a
    // single /hizmetler page has plenty for a rail, and judging it by page
    // count alone dropped the services section from a services business.
    hasServices: serviceItems >= 2 || services.length >= 2,
    hasTeam: team.length >= 1,
    hasFaq: faq >= 2,
    hasGallery: input.usablePhotos >= 6,
    hasTestimonials: testimonials.length >= 1,
    // A business that publishes "10.00-19.30" without naming the days still
    // has hours worth a section — `facts.hoursNote` carries them verbatim
    // when no day mapping exists (DECISIONS D8). Judging by openingHours
    // alone dropped the hours section from every such site, which is exactly
    // what D5 requires a visitor to be able to see.
    hasHours: hours >= 1 || typeof input.facts.hoursNote === "string",
  };
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
