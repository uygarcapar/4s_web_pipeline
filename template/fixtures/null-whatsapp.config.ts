import { siteConfigSchema, type SiteConfigInput } from "@/lib/schema";

/**
 * Fixture: a business that publishes **no** WhatsApp number, no registered
 * trade name and no day-mapped opening hours — the D8 degradation path.
 *
 * This is the shape that blocked A0: `template/site.config.ts` publishes a
 * WhatsApp number, so the null branch of every WhatsApp-dependent component
 * and of `smoke.spec.ts` was only ever reached by hand-editing the config.
 * Committing it makes that branch gated. Modelled on Atakent Derma Güzellik
 * (the dermaguzellik.com run) but with fictional contact details.
 *
 * Run the gates against it with:
 *
 *     VERIFY_FIXTURE=fixtures/null-whatsapp.config.ts pnpm run verify
 */
const config: SiteConfigInput = {
  business: {
    name: "Atakent Güzellik Merkezi",
    // D8: the business publishes no registered trade name.
    legalName: null,
    slogan: "Küçükçekmece'de cilt ve bakım",
  },
  businessType: "BeautySalon",
  contact: {
    phoneE164: "+905321234567",
    // The point of this fixture.
    whatsappE164: null,
    email: "randevu@atakentguzellik.example",
    address: "Atakent Mah. Zafer Cad. No: 12/B",
    district: "Küçükçekmece",
    city: "İstanbul",
    mapsEmbedQuery: "Atakent Mahallesi Küçükçekmece İstanbul",
  },
  // D8: the site publishes one range with no day mapping, so openingHours is
  // empty and hoursNote carries the published string verbatim.
  openingHours: [],
  hoursNote: "Her gün 10.00-19.30",
  brand: {
    hue: 320,
    chroma: 0.09,
    fontHeading: "Fraunces",
    fontBody: "Karla",
  },
  seo: {
    title: "Atakent Güzellik Merkezi — Küçükçekmece Cilt Bakımı",
    description:
      "Küçükçekmece Atakent'te cilt bakımı, lazer epilasyon ve bölgesel incelme. Randevu için hemen arayın.",
  },
  kvkk: {
    companyTitle: "Atakent Güzellik Merkezi",
    mersisNo: "0987654321098765",
    dataController: "Atakent Güzellik Merkezi",
  },
  sellsOnline: false,
  sections: [
    {
      type: "hero",
      id: "hero",
      variant: "type-only",
      headline: "Küçükçekmece'de cilt ve bakım",
      subheadline:
        "Atakent Güzellik Merkezi'nde cilt bakımı, lazer epilasyon ve bölgesel incelme uygulamaları deneyimli ekibimizle yapılır. Randevu için bizi arayın.",
      // Both CTAs dial: with whatsappE164 null, siteConfigSchema rejects a
      // "whatsapp" action outright, so a plan for this business cannot use one.
      ctaPrimary: { label: "Hemen Ara", action: "tel" },
      ctaSecondary: { label: "Çalışma Saatleri", action: "link", href: "#hours" },
      image: {
        src: "/images/hero-placeholder.svg",
        alt: "Atakent Güzellik Merkezi uygulama odası",
      },
    },
    {
      type: "services",
      id: "services",
      variant: "accordion",
      title: "Hizmetlerimiz",
      items: [
        {
          title: "Cilt Bakımı",
          description:
            "Cilt tipinize göre planlanan temizlik, nemlendirme ve bakım uygulamaları.",
          icon: "sparkles",
        },
        {
          title: "Lazer Epilasyon",
          description:
            "Seans aralıkları cilt ve tüy yapınıza göre belirlenen lazer epilasyon.",
          icon: "zap",
        },
        {
          title: "Bölgesel İncelme",
          description:
            "Bölgesel incelme ve sıkılaştırma uygulamaları için cihaz destekli programlar.",
          icon: "activity",
        },
      ],
    },
    {
      type: "hours",
      id: "hours",
      variant: "default",
      title: "Çalışma Saatleri",
      // No note of its own: the section renders config.hoursNote (D8).
    },
    {
      type: "contact",
      id: "contact",
      variant: "default",
      title: "İletişim",
      showForm: true,
    },
    {
      type: "map",
      id: "map",
      variant: "default",
    },
  ],
};

/** Validated here too, so a broken fixture fails its own test. */
export const nullWhatsappConfig = siteConfigSchema.parse(config);

/**
 * Same name `site.config.ts` exports, because `VERIFY_FIXTURE` runs the gates
 * by copying this file over it and every consumer imports
 * `{ siteConfig } from "~config"`.
 */
export const siteConfig = nullWhatsappConfig;

export default nullWhatsappConfig;
