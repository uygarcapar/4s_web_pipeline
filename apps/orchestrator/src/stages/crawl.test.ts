import { describe, expect, it } from "vitest";
import {
  buildContentArtifact,
  dedupeFaqPairs,
  faqFromContentBlocks,
  faqFromJsonLd,
  findAddressCandidates,
  findHoursCandidates,
  findPhoneCandidates,
  hasMojibake,
  isServiceDescription,
  isServiceTitle,
  isTooSmallImage,
  normalizeUrl,
  originalAssetUrl,
  plainText,
  readImageDimensions,
  servicesFromPages,
  slugForUrl,
  type ContentBlock,
  type ContentSourcePage,
} from "./crawl-extract.js";

describe("findPhoneCandidates", () => {
  it("matches Turkish mobile formats", () => {
    const text =
      "Bize ulaşın: 0532 123 45 67 veya +90 532 987 65 43, " +
      "kısa: 05321112233, noktalı: 532.123.45.67";
    const { mobile } = findPhoneCandidates(text);
    expect(mobile).toContain("0532 123 45 67");
    expect(mobile).toContain("+90 532 987 65 43");
    expect(mobile).toContain("05321112233");
    expect(mobile).toContain("532.123.45.67");
  });

  it("matches Turkish landline formats", () => {
    const text = "Tel: 0212 345 67 89 / (216) 345 67 89 / +90 312 444 55 66";
    const { landline } = findPhoneCandidates(text);
    expect(landline).toContain("0212 345 67 89");
    expect(landline).toContain("(216) 345 67 89");
    expect(landline).toContain("+90 312 444 55 66");
  });

  it("does not match short digit runs or dedupe duplicates twice", () => {
    const { mobile, landline } = findPhoneCandidates(
      "Sipariş no: 1234, saat 09:00. 0532 123 45 67 ve yine 0532 123 45 67",
    );
    expect(mobile).toEqual(["0532 123 45 67"]);
    expect(landline).toEqual([]);
  });

  it("returns empty arrays for empty text", () => {
    expect(findPhoneCandidates("")).toEqual({ mobile: [], landline: [] });
  });
});

describe("findHoursCandidates", () => {
  it("keeps lines with a Turkish day name and a time", () => {
    const text = [
      "Çalışma Saatleri",
      "Pzt - Cum: 09:00 - 18:00",
      "Cumartesi 10.30 - 17.00",
      "Pazar kapalı",
      "Randevu için arayın",
    ].join("\n");
    expect(findHoursCandidates(text)).toEqual([
      "Pzt - Cum: 09:00 - 18:00",
      "Cumartesi 10.30 - 17.00",
    ]);
  });

  it("requires both a day and a time on the same line", () => {
    expect(findHoursCandidates("Açılış: 09:00\nSalı günleri yoğun")).toEqual(
      [],
    );
  });

  it("joins an every-day label to the range on the following line", () => {
    // How minaguzellik.com publishes its only hours. "Tüm Günler" matched
    // no label pattern, so the range was never collected and the salon's
    // facts recorded no opening hours at all.
    const text = ["İletişim", "Apt. No: 27/6", "", "Tüm Günler:", "09:00 – 20:00", ""].join(
      "\n",
    );
    expect(findHoursCandidates(text)).toEqual(["Tüm Günler: 09:00 – 20:00"]);
  });

  it("keeps an every-day label and range that share a line", () => {
    expect(findHoursCandidates("Her gün 10.00-19.30")).toEqual(["Her gün 10.00-19.30"]);
  });

  it("does not duplicate a line that already names a day", () => {
    expect(findHoursCandidates("Pazar günleri 09:00 - 20:00")).toEqual([
      "Pazar günleri 09:00 - 20:00",
    ]);
  });
});

describe("findAddressCandidates", () => {
  it("keeps lines containing Turkish address tokens", () => {
    const text = [
      "Hoş geldiniz",
      "Atatürk Mah. İnönü Cad. No: 5 Kat: 2 Kadıköy/İstanbul",
      "Bizi takip edin",
      "Çamlık Sokak 12",
    ].join("\n");
    expect(findAddressCandidates(text)).toEqual([
      "Atatürk Mah. İnönü Cad. No: 5 Kat: 2 Kadıköy/İstanbul",
      "Çamlık Sokak 12",
    ]);
  });

  it("returns empty for text without address tokens", () => {
    expect(findAddressCandidates("Sadece telefon: 0532 123 45 67")).toEqual(
      [],
    );
  });

  it("does not match an address token inside a longer word", () => {
    // "Dikkat:" ends in "kat:", so this microblading aftercare sentence was
    // collected as an address candidate — and, being the longest one, was
    // published as the first real client's street address.
    expect(
      findAddressCandidates(
        "Duş Alırken Dikkat: Duş alırken kaşları yoğun su temasından korumak için vazelin uygulayabilirsiniz.",
      ),
    ).toEqual([]);
  });

  it("still matches a genuine Kat: after a word boundary", () => {
    const line = "Nazım Hikmet Bulvarı No: 25 Kat:2 Beylikdüzü / İstanbul";
    expect(findAddressCandidates(line)).toEqual([line]);
  });
});

describe("servicesFromPages", () => {
  const page = (
    path: string,
    name: string,
    blocks: ContentBlock[] = [],
    h1: string[] = [name],
  ): ContentSourcePage => ({
    url: `https://minaguzellik.com${path}`,
    slug: path.replace(/^\//, "") || "index",
    title: `${name} - Mina Güzellik Merkezi`,
    h1,
    contentBlocks: blocks,
    jsonLd: [
      {
        "@type": "BreadcrumbList",
        itemListElement: [{ item: { name: "Ana sayfa" } }, { item: { name } }],
      },
    ],
  });

  const prose = (text: string): ContentBlock => ({ tag: "p", text });

  it("reads a service off its own page", () => {
    // 21 pages like this, and the heading scan found none of them: no
    // service page announces "Hizmetlerimiz" in its H1.
    const services = servicesFromPages([
      page("/microblading", "Microblading", [
        prose("Microblading, kaşların görünümünü iyileştirmek için kullanılan bir işlemdir."),
      ]),
    ]);
    expect(services).toEqual([
      {
        title: "Microblading",
        description:
          "Microblading, kaşların görünümünü iyileştirmek için kullanılan bir işlemdir.",
        sourceUrl: "https://minaguzellik.com/microblading",
      },
    ]);
  });

  it("keeps a service page that has no usable prose", () => {
    const [only] = servicesFromPages([page("/botoks", "Botoks", [prose("Kısa.")])]);
    expect(only?.title).toBe("Botoks");
    expect(only?.description).toBe("");
  });

  it("excludes boilerplate page kinds", () => {
    const pages = [
      page("/", "Anasayfa"),
      page("/about-us", "Hakkımızda"),
      page("/gallery", "Galeri"),
      page("/contact", "İletişim"),
      page("/iletisim-2", "Randevu Formu"),
      page("/tesekkurler", "Teşekkürler"),
      page("/services", "Hizmetlerimiz"),
      page("/blog/kas-bakimi-nasil", "Kaş Bakımı Nasıl Yapılır"),
    ];
    expect(servicesFromPages(pages)).toEqual([]);
  });

  it("drops a page whose name is not in Latin script", () => {
    expect(servicesFromPages([page("/lazer-fa", "لیزر مو برای مرد ها")])).toEqual([]);
  });

  it("rejects contact furniture that shares the services markup", () => {
    // The whole bug: this one item was the entire services list handed to
    // the design stage, for a salon with 21 service pages.
    const listing = page(
      "/services",
      "Hizmetlerimiz",
      [
        { tag: "h2", text: "WHATSAPP HATTIMIZ:" },
        prose("Cumhuriyet Mah. Nazım Hikmet Bulvarı No: 25 Kat:2 Beylikdüzü / İstanbul"),
      ],
      ["Hizmetlerimiz"],
    );
    expect(servicesFromPages([listing])).toEqual([]);
  });

  it("still reads a one-page services listing", () => {
    // The layout the heading scan existed for, and which must keep working.
    const listing = page(
      "/services",
      "Hizmetlerimiz",
      [
        { tag: "h2", text: "Lazer Epilasyon" },
        prose("İstenmeyen tüylerin kalıcı olarak azaltılması için uygulanan yöntemdir."),
        { tag: "h2", text: "Cilt Bakımı" },
        prose("Cildin ihtiyacına göre temizlik, nemlendirme ve bakım uygulamalarıdır."),
      ],
      ["Hizmetlerimiz"],
    );
    expect(servicesFromPages([listing]).map((s) => s.title)).toEqual([
      "Lazer Epilasyon",
      "Cilt Bakımı",
    ]);
  });

  it("does not list the same service twice when it has a page and a listing entry", () => {
    const services = servicesFromPages([
      page("/lazer-epilasyon", "Lazer Epilasyon", [
        prose("İstenmeyen tüylerin kalıcı olarak azaltılması için uygulanan yöntemdir."),
      ]),
      page(
        "/services",
        "Hizmetlerimiz",
        [
          { tag: "h2", text: "Lazer Epilasyon" },
          prose("Aynı hizmetin listedeki kısa açıklaması burada yer alır."),
        ],
        ["Hizmetlerimiz"],
      ),
    ]);
    expect(services.map((s) => s.title)).toEqual(["Lazer Epilasyon"]);
  });

  it("prefers the breadcrumb name over the slug", () => {
    // /kas-kontur is "Kıl Tekniği"; the slug is no guide to the name.
    expect(servicesFromPages([page("/kas-kontur", "Kıl Tekniği")])[0]?.title).toBe(
      "Kıl Tekniği",
    );
  });
});

describe("isServiceTitle / isServiceDescription", () => {
  it("rejects a label that introduces something", () => {
    expect(isServiceTitle("WHATSAPP HATTIMIZ:")).toBe(false);
    expect(isServiceTitle("Telefon")).toBe(false);
    expect(isServiceTitle("Bizi Takip Edin")).toBe(false);
  });

  it("accepts a real service name", () => {
    expect(isServiceTitle("Kalıcı Makyaj")).toBe(true);
    expect(isServiceTitle("Erkeklere Özel Manikür ve Pedikür")).toBe(true);
  });

  it("rejects an address as a description", () => {
    expect(
      isServiceDescription(
        "Cumhuriyet Mah. Nazım Hikmet Bulvarı No: 25 Kat:2 Beylikdüzü / İstanbul",
      ),
    ).toBe(false);
  });

  it("accepts prose about the service", () => {
    expect(
      isServiceDescription("Cildin ihtiyacına göre temizlik ve bakım uygulamalarıdır."),
    ).toBe(true);
  });
});

describe("hasMojibake", () => {
  it("flags UTF-8-as-Latin-1 sequences", () => {
    expect(hasMojibake("Ã§ay bahÃ§esi")).toBe(true);
    expect(hasMojibake("yanlÄ±ÅŸ kodlama")).toBe(true);
  });

  it("does not flag correct Turkish text", () => {
    expect(hasMojibake("çay bahçesi, yanlış kodlama yok")).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it("strips fragments and trailing slashes, lowercases the host", () => {
    expect(normalizeUrl("https://Example.COM/Hakkimizda/#top")).toBe(
      "https://example.com/Hakkimizda",
    );
  });

  it("keeps the root path slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("rejects non-http(s) and unparseable input", () => {
    expect(normalizeUrl("mailto:info@example.com")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("slugForUrl", () => {
  it("uses 'index' for the root path", () => {
    expect(slugForUrl("https://example.com/")).toBe("index");
  });

  it("sanitizes nested paths", () => {
    expect(slugForUrl("https://example.com/hizmetler/dis-beyazlatma/")).toBe(
      "hizmetler-dis-beyazlatma",
    );
  });

  it("collapses non-ascii characters to hyphens", () => {
    expect(slugForUrl("https://example.com/ürünler/çay")).toBe("r-nler-ay");
  });

  it("falls back to 'index' for unparseable input", () => {
    expect(slugForUrl("not a url")).toBe("index");
  });
});

/* ------------------------------------------------------------------ */
/* Image header dimensions (hand-built headers, no files, no network) */
/* ------------------------------------------------------------------ */

const ascii = (text: string): number[] =>
  [...text].map((c) => c.charCodeAt(0));
const be16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number): number[] => [...be16(n >>> 16), ...be16(n & 0xffff)];
const le16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const le24 = (n: number): number[] => [...le16(n & 0xffff), (n >> 16) & 0xff];

function pngHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0x89,
    ...ascii("PNG"),
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...be32(13),
    ...ascii("IHDR"),
    ...be32(width),
    ...be32(height),
    8,
    6,
    0,
    0,
    0,
  ]);
}

function jpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8, // SOI
    0xff,
    0xe0, // APP0
    ...be16(16),
    ...ascii("JFIF"),
    0,
    1,
    1,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
    0xff,
    0xdb, // DQT, skipped
    ...be16(4),
    0,
    0,
    0xff,
    0xc0, // SOF0
    ...be16(17),
    8, // sample precision
    ...be16(height),
    ...be16(width),
    3,
    1,
    0x22,
    0,
  ]);
}

function gifHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    ...ascii("GIF89a"),
    ...le16(width),
    ...le16(height),
    0xf7,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
}

function webpLossyHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBP"),
    ...ascii("VP8 "),
    0,
    0,
    0,
    0,
    0x10,
    0x00,
    0x00, // frame tag
    0x9d,
    0x01,
    0x2a, // sync code
    ...le16(width),
    ...le16(height),
  ]);
}

function webpLosslessHeader(width: number, height: number): Uint8Array {
  const bits = (width - 1) | ((height - 1) << 14);
  return new Uint8Array([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBP"),
    ...ascii("VP8L"),
    0,
    0,
    0,
    0,
    0x2f,
    bits & 0xff,
    (bits >>> 8) & 0xff,
    (bits >>> 16) & 0xff,
    (bits >>> 24) & 0xff,
  ]);
}

function webpExtendedHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBP"),
    ...ascii("VP8X"),
    0,
    0,
    0,
    0,
    0x10, // flags
    0,
    0,
    0, // reserved
    ...le24(width - 1),
    ...le24(height - 1),
  ]);
}

describe("readImageDimensions", () => {
  it("reads a PNG IHDR header", () => {
    expect(readImageDimensions(pngHeader(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("reads a JPEG SOFn header past skipped segments", () => {
    expect(readImageDimensions(jpegHeader(800, 600))).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("reads a GIF logical screen descriptor", () => {
    expect(readImageDimensions(gifHeader(120, 90))).toEqual({
      width: 120,
      height: 90,
    });
  });

  it("reads WebP VP8, VP8L and VP8X headers", () => {
    expect(readImageDimensions(webpLossyHeader(640, 480))).toEqual({
      width: 640,
      height: 480,
    });
    expect(readImageDimensions(webpLosslessHeader(300, 200))).toEqual({
      width: 300,
      height: 200,
    });
    expect(readImageDimensions(webpExtendedHeader(1600, 900))).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it("returns nulls for unsupported, truncated or empty data", () => {
    const unknown = { width: null, height: null };
    expect(readImageDimensions(new Uint8Array(0))).toEqual(unknown);
    expect(readImageDimensions(pngHeader(10, 10).slice(0, 12))).toEqual(
      unknown,
    );
    // SVG markup and an AVIF-style ftyp box are not header-measurable.
    expect(readImageDimensions(new Uint8Array(ascii("<svg width='10'>")))).toEqual(
      unknown,
    );
    expect(
      readImageDimensions(
        new Uint8Array([...be32(24), ...ascii("ftypavif"), ...new Array(8).fill(0)]),
      ),
    ).toEqual(unknown);
  });

  it("does not mistake a JPEG with no SOF for a sized image", () => {
    expect(
      readImageDimensions(new Uint8Array([0xff, 0xd8, ...new Array(20).fill(0)])),
    ).toEqual({ width: null, height: null });
  });
});

describe("isTooSmallImage", () => {
  it("rejects tiny files regardless of dimensions", () => {
    expect(isTooSmallImage(900, { width: 2000, height: 1200 }, 10_000, 200)).toBe(
      true,
    );
  });

  it("rejects icons whose long edge is under the threshold", () => {
    expect(isTooSmallImage(50_000, { width: 180, height: 120 }, 10_000, 200)).toBe(
      true,
    );
  });

  it("keeps real photography", () => {
    expect(
      isTooSmallImage(240_000, { width: 1200, height: 800 }, 10_000, 200),
    ).toBe(false);
  });

  it("keeps big-enough files whose dimensions are unknown", () => {
    expect(isTooSmallImage(240_000, { width: null, height: null }, 10_000, 200)).toBe(
      false,
    );
  });
});

/* ------------------------------------------------------------------ */
/* CDN transform URLs                                                 */
/* ------------------------------------------------------------------ */

describe("originalAssetUrl", () => {
  it("truncates a wixstatic transform at /v1/", () => {
    const resized =
      "https://static.wixstatic.com/media/512fd9_abc~mv2.png/v1/fill/" +
      "w_171,h_60,al_c,q_85,enc_avif,quality_auto/diskent-logo.png";
    expect(originalAssetUrl(resized)).toBe(
      "https://static.wixstatic.com/media/512fd9_abc~mv2.png",
    );
  });

  it("truncates a wixstatic crop transform too", () => {
    const cropped =
      "https://static.wixstatic.com/media/512fd9_x~mv2.jpg/v1/crop/" +
      "x_101,y_0,w_1571,h_2268/fill/w_151,h_218/Nesrin.jpg";
    expect(originalAssetUrl(cropped)).toBe(
      "https://static.wixstatic.com/media/512fd9_x~mv2.jpg",
    );
  });

  it("drops a WordPress -WxH filename suffix", () => {
    expect(originalAssetUrl("https://cdn.example.com/wp/klinik-1024x768.jpg")).toBe(
      "https://cdn.example.com/wp/klinik.jpg",
    );
  });

  it("returns null when there is no transform segment", () => {
    expect(
      originalAssetUrl("https://static.wixstatic.com/media/512fd9_abc~mv2.png"),
    ).toBeNull();
    expect(originalAssetUrl("https://example.com/images/hero.jpg")).toBeNull();
  });

  it("returns null when /v1/ is not a file-path suffix", () => {
    expect(originalAssetUrl("https://api.example.com/v1/images/hero.jpg")).toBeNull();
  });

  it("returns null for data URIs and unparseable input", () => {
    expect(originalAssetUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(originalAssetUrl("not a url")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* FAQ pairing + content artifact                                     */
/* ------------------------------------------------------------------ */

const block = (tag: string, text: string): ContentBlock => ({ tag, text });

describe("plainText", () => {
  it("strips markup and entities from schema.org answers", () => {
    expect(plainText("<p>Diş  beyazlatma&nbsp;<b>2 saat</b> sürer.</p>")).toBe(
      "Diş beyazlatma 2 saat sürer.",
    );
  });
});

describe("faqFromContentBlocks", () => {
  it("pairs a question block with the next non-heading block", () => {
    const blocks = [
      block("h2", "Sıkça Sorulan Sorular"),
      block("h3", "Diş beyazlatma ne kadar sürer?"),
      block("p", "Tek seansta yaklaşık 45 dakika sürer."),
      block("h3", "Implant tedavisi ağrılı mı?"),
      block("p", "Lokal anestezi ile ağrı duymazsınız."),
    ];
    expect(faqFromContentBlocks(blocks, "https://example.com/sss")).toEqual([
      {
        question: "Diş beyazlatma ne kadar sürer?",
        answer: "Tek seansta yaklaşık 45 dakika sürer.",
        sourceUrl: "https://example.com/sss",
      },
      {
        question: "Implant tedavisi ağrılı mı?",
        answer: "Lokal anestezi ile ağrı duymazsınız.",
        sourceUrl: "https://example.com/sss",
      },
    ]);
  });

  it("ignores a question whose next block is a heading", () => {
    const blocks = [
      block("h3", "Randevu nasıl alınır?"),
      block("h2", "İletişim"),
      block("p", "Telefon: 0212 345 67 89"),
    ];
    expect(faqFromContentBlocks(blocks, "https://example.com/")).toEqual([]);
  });

  it("does not use a following question as an answer", () => {
    const blocks = [
      block("p", "Fiyatlar nedir?"),
      block("p", "Taksit var mı?"),
      block("p", "Kredi kartına 6 taksit yapılır."),
    ];
    const pairs = faqFromContentBlocks(blocks, "https://example.com/");
    expect(pairs).toEqual([
      {
        question: "Taksit var mı?",
        answer: "Kredi kartına 6 taksit yapılır.",
        sourceUrl: "https://example.com/",
      },
    ]);
  });

  it("ignores blocks that are not questions and dedupes repeats", () => {
    const blocks = [
      block("p", "Kliniğimiz Kadıköy'de hizmet veriyor."),
      block("p", "Nerede bulunuyorsunuz?"),
      block("p", "Kadıköy, İstanbul."),
      block("p", "Nerede bulunuyorsunuz?"),
      block("p", "Kadıköy, İstanbul."),
    ];
    expect(faqFromContentBlocks(blocks, "https://example.com/")).toHaveLength(1);
  });

  it("returns an empty array when nothing looks like a question", () => {
    expect(
      faqFromContentBlocks(
        [block("h1", "Hoş geldiniz"), block("p", "Diş kliniği")],
        "https://example.com/",
      ),
    ).toEqual([]);
  });
});

describe("faqFromJsonLd", () => {
  it("reads FAQPage mainEntity questions", () => {
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Dolgu ne kadar dayanır?",
            acceptedAnswer: { "@type": "Answer", text: "<p>5-10 yıl</p>" },
          },
        ],
      },
    ];
    expect(faqFromJsonLd(jsonLd, "https://example.com/sss")).toEqual([
      {
        question: "Dolgu ne kadar dayanır?",
        answer: "5-10 yıl",
        sourceUrl: "https://example.com/sss",
      },
    ]);
  });

  it("finds Question nodes nested in a @graph and full type URLs", () => {
    const jsonLd = [
      {
        "@graph": [
          { "@type": "Dentist", name: "Dişkent" },
          {
            "@type": "http://schema.org/Question",
            name: "Ücretler nedir?",
            suggestedAnswer: [{ text: "Muayene 500 TL" }],
          },
        ],
      },
    ];
    expect(faqFromJsonLd(jsonLd, "https://example.com/")).toEqual([
      {
        question: "Ücretler nedir?",
        answer: "Muayene 500 TL",
        sourceUrl: "https://example.com/",
      },
    ]);
  });

  it("skips questions without an answer and non-FAQ JSON-LD", () => {
    expect(
      faqFromJsonLd(
        [
          { "@type": "Question", name: "Cevapsız soru?" },
          { "@type": "LocalBusiness", name: "Dişkent" },
        ],
        "https://example.com/",
      ),
    ).toEqual([]);
  });

  it("returns an empty array for empty JSON-LD", () => {
    expect(faqFromJsonLd([], "https://example.com/")).toEqual([]);
  });
});

describe("dedupeFaqPairs", () => {
  it("keeps the first pair per question, ignoring case and spacing", () => {
    const pairs = dedupeFaqPairs([
      { question: "Nerede?", answer: "Kadıköy", sourceUrl: "a" },
      { question: "nerede?", answer: "İstanbul", sourceUrl: "b" },
      { question: "Nerede   ?", answer: "Başka", sourceUrl: "c" },
    ]);
    expect(pairs).toEqual([
      { question: "Nerede?", answer: "Kadıköy", sourceUrl: "a" },
      { question: "Nerede   ?", answer: "Başka", sourceUrl: "c" },
    ]);
  });
});

describe("buildContentArtifact", () => {
  it("merges pages, FAQ pairs (JSON-LD first) and headings", () => {
    const artifact = buildContentArtifact([
      {
        url: "https://example.com/",
        slug: "index",
        title: "Dişkent",
        h1: ["Dişkent Diş Kliniği"],
        contentBlocks: [
          block("h1", "Dişkent Diş Kliniği"),
          block("h2", "Hizmetlerimiz"),
          block("p", "İmplant, ortodonti ve estetik diş hekimliği."),
          block("h3", "Randevu nasıl alınır?"),
          block("p", "Telefonla veya WhatsApp üzerinden."),
        ],
        jsonLd: [
          {
            "@type": "FAQPage",
            mainEntity: {
              "@type": "Question",
              name: "Pazar günü açık mısınız?",
              acceptedAnswer: { text: "Pazar kapalıyız." },
            },
          },
        ],
      },
      {
        url: "https://example.com/sss",
        slug: "sss",
        title: "SSS",
        h1: ["Sıkça Sorulan Sorular"],
        contentBlocks: [
          block("h1", "Sıkça Sorulan Sorular"),
          // Already present from the homepage JSON-LD: deduped.
          block("h2", "Pazar günü açık mısınız?"),
          block("p", "Hayır."),
        ],
        jsonLd: [],
      },
    ]);

    expect(artifact.pages.map((p) => p.slug)).toEqual(["index", "sss"]);
    expect(artifact.pages[0]?.contentBlocks).toHaveLength(5);
    expect(artifact.faq).toEqual([
      {
        question: "Pazar günü açık mısınız?",
        answer: "Pazar kapalıyız.",
        sourceUrl: "https://example.com/",
      },
      {
        question: "Randevu nasıl alınır?",
        answer: "Telefonla veya WhatsApp üzerinden.",
        sourceUrl: "https://example.com/",
      },
    ]);
    expect(artifact.headings).toEqual([
      {
        text: "Dişkent Diş Kliniği",
        level: 1,
        sourceUrl: "https://example.com/",
      },
      { text: "Hizmetlerimiz", level: 2, sourceUrl: "https://example.com/" },
      {
        text: "Randevu nasıl alınır?",
        level: 3,
        sourceUrl: "https://example.com/",
      },
      {
        text: "Sıkça Sorulan Sorular",
        level: 1,
        sourceUrl: "https://example.com/sss",
      },
      {
        text: "Pazar günü açık mısınız?",
        level: 2,
        sourceUrl: "https://example.com/sss",
      },
    ]);
  });

  it("emits empty faq/headings for pages with no content", () => {
    expect(
      buildContentArtifact([
        {
          url: "https://example.com/",
          slug: "index",
          title: "",
          h1: [],
          contentBlocks: [],
          jsonLd: [],
        },
      ]),
    ).toEqual({
      pages: [
        {
          url: "https://example.com/",
          slug: "index",
          title: "",
          h1: [],
          contentBlocks: [],
        },
      ],
      faq: [],
      headings: [],
    });
  });
});
