import { describe, expect, it } from "vitest";
import { isPersonPage, isServicePage, takeInventory } from "./inventory.js";

/** The real page list from the diskent.com crawl, trimmed to its shape. */
const DISKENT_PAGES = [
  { slug: "index", title: "Dişkent Diş Kliniği Kadıköy", contentBlocks: new Array(53) },
  { slug: "iletisim", title: "İletişim", contentBlocks: new Array(10) },
  { slug: "dis-tedavi-randevu", title: "Randevu", contentBlocks: new Array(2) },
  { slug: "dt-nesrin-topcu-yazar", title: "Diş Hekimi Nesrin Topçu Yazar | Diskent", contentBlocks: new Array(16) },
  { slug: "blog", title: "Blog", contentBlocks: new Array(4) },
  { slug: "di-hekimi-erkin-zalp", title: "Diş Hekimi Erkin Özalp | Diskent", contentBlocks: new Array(36) },
  { slug: "dr-merve-ozturk", title: "Ortodonti Uzmanı Merve Öztürk | Diskent", contentBlocks: new Array(23) },
  { slug: "ozan-burak-iskefli", title: "Periodontolog Ozan Burak İskefli | Diskent", contentBlocks: new Array(17) },
  { slug: "dr-duygu-bilgili", title: "Endodonti Uzmanı Duygu Bilgili | Diskent", contentBlocks: new Array(19) },
  { slug: "hizmetlerimiz-protez-dis", title: "Protez Diş", contentBlocks: new Array(10) },
  { slug: "hizmetlerimiz-zirkonyum", title: "Zirkonyum", contentBlocks: new Array(10) },
  { slug: "hizmetlerimiz-ortodonti", title: "Ortodonti", contentBlocks: new Array(10) },
  { slug: "hizmetlerimiz-cene-cerrahisi", title: "Çene Cerrahisi", contentBlocks: new Array(10) },
  { slug: "hizmetlerimiz-implant-dis", title: "İmplant Diş", contentBlocks: new Array(10) },
  { slug: "post-kad-k-y-di-i-i-in-g-venilir-hekimler", title: "Kadıköy diş hekimleri", contentBlocks: new Array(41) },
];

describe("page role inference", () => {
  it("reads the clinic's treatment pages as services", () => {
    expect(isServicePage({ slug: "hizmetlerimiz-zirkonyum" })).toBe(true);
    expect(isServicePage({ slug: "tedavi-kanal" })).toBe(true);
  });

  it("reads a doctor's page as a person, by slug or by title", () => {
    expect(isPersonPage({ slug: "dr-merve-ozturk" })).toBe(true);
    expect(isPersonPage({ slug: "ozan-burak-iskefli", title: "Periodontolog Ozan Burak İskefli" })).toBe(true);
    expect(isPersonPage({ slug: "ekip/12", title: "Uzm. Dr. Ayşe Yılmaz" })).toBe(true);
  });

  it("does not mistake a blog post about dentists for a dentist", () => {
    expect(isPersonPage({ slug: "post-kad-k-y-di-i-i-in-g-venilir-hekimler", title: "Güvenilir hekimler" })).toBe(false);
    expect(isServicePage({ slug: "post-dis-tedavi-rehberi" })).toBe(false);
  });

  it("does not mistake a person's page for a service", () => {
    expect(isServicePage({ slug: "dr-merve-ozturk", title: "Ortodonti Uzmanı Merve Öztürk" })).toBe(false);
  });

  it("keeps a treatment named after a profession on the services side", () => {
    // real page from the crawl: a paediatric dentistry *service*, whose slug
    // ends in "hekimi". Classed as a person it stole a service and invented
    // a sixth doctor.
    const page = {
      slug: "hizmetlerimiz-cocuk-dis-hekimi",
      title: "Pedodonti - Çocuk Diş Hekimliği | Türkiye'nin Diş Kliniği",
    };
    expect(isServicePage(page)).toBe(true);
    expect(isPersonPage(page)).toBe(false);
  });
});

describe("takeInventory on the real diskent.com crawl", () => {
  const inv = takeInventory({
    content: { pages: DISKENT_PAGES, faq: new Array(18) },
    facts: { openingHours: new Array(6) },
    usablePhotos: 24,
  });

  it("finds the treatment pages the first version dropped", () => {
    expect(inv.services.length).toBe(5);
    expect(inv.hasServices).toBe(true);
  });

  it("finds all five doctors", () => {
    expect(inv.team.length).toBe(5);
    expect(inv.hasTeam).toBe(true);
  });

  it("keeps blog posts out of both", () => {
    expect(inv.posts.length).toBe(1);
    expect(inv.services.some((p) => p.slug?.startsWith("post-"))).toBe(false);
    expect(inv.team.some((p) => p.slug?.startsWith("post-"))).toBe(false);
  });

  it("counts the content the crawl really captured", () => {
    expect(inv.contentBlocks).toBeGreaterThan(250);
  });

  it("enables the sections that have content and no others", () => {
    expect(inv.hasFaq).toBe(true);
    expect(inv.hasHours).toBe(true);
    expect(inv.hasGallery).toBe(true);
    expect(inv.hasTestimonials).toBe(false);
  });
});

describe("takeInventory on a sparse site", () => {
  it("drops a section rather than padding it", () => {
    const inv = takeInventory({
      content: { pages: [{ slug: "index", contentBlocks: new Array(12) }], faq: [] },
      facts: {},
      usablePhotos: 1,
    });
    expect(inv.hasServices).toBe(false);
    expect(inv.hasTeam).toBe(false);
    expect(inv.hasFaq).toBe(false);
    expect(inv.hasGallery).toBe(false);
    expect(inv.hasHours).toBe(false);
  });

  it("treats one lonely treatment page as a paragraph, not a section", () => {
    const inv = takeInventory({
      content: { pages: [{ slug: "hizmetlerimiz-tek" }], faq: [] },
      facts: {},
      usablePhotos: 0,
    });
    expect(inv.services.length).toBe(1);
    expect(inv.hasServices).toBe(false);
  });

  it("survives a crawl that produced nothing", () => {
    const inv = takeInventory({ content: null, facts: {}, usablePhotos: 0 });
    expect(inv.contentBlocks).toBe(0);
    expect(inv.hasServices).toBe(false);
  });
});
