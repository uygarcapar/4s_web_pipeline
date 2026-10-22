import { siteConfigSchema, type SiteConfigInput } from "@/lib/schema";

/**
 * Single source of truth for the generated site.
 *
 * This file (together with src/sections/** and src/styles/tokens.css) is the
 * ONLY code the LLM fill stage is allowed to rewrite per client. It is
 * validated with `siteConfigSchema.parse` at module load, so an invalid
 * config fails the build instead of shipping a broken site.
 *
 * The data below is a realistic but entirely FICTIONAL placeholder business
 * (a dental clinic in Kadıköy) so the template builds and renders end-to-end.
 */
const config: SiteConfigInput = {
  business: {
    name: "Moda Diş Kliniği",
    legalName: "Moda Ağız ve Diş Sağlığı Hizmetleri Ltd. Şti.",
    slogan: "Kadıköy'de güvenle gülümseyin",
  },
  businessType: "Dentist",
  contact: {
    phoneE164: "+905551234567",
    whatsappE164: "+905551234567",
    email: "info@modadisklinigi.example",
    address: "Caferağa Mah. Moda Cad. No: 48/A",
    district: "Kadıköy",
    city: "İstanbul",
    mapsEmbedQuery: "Moda Caddesi 48 Kadıköy İstanbul",
  },
  openingHours: [
    { day: 1, opens: "09:00", closes: "19:00" },
    { day: 2, opens: "09:00", closes: "19:00" },
    { day: 3, opens: "09:00", closes: "19:00" },
    { day: 4, opens: "09:00", closes: "19:00" },
    { day: 5, opens: "09:00", closes: "19:00" },
    { day: 6, opens: "10:00", closes: "16:00" },
    { day: 7, opens: null, closes: null },
  ],
  /**
   * Only used when `openingHours` is empty: the hours string the business
   * publishes verbatim, with no day mapping inferred (DECISIONS D8).
   */
  hoursNote: null,
  brand: {
    hue: 220,
    chroma: 0.12,
    fontHeading: "Lora",
    fontBody: "Inter",
  },
  seo: {
    title: "Moda Diş Kliniği — Kadıköy Diş Hekimi",
    description:
      "Kadıköy Moda'da diş hekimi. İmplant, diş beyazlatma, ortodonti ve çocuk diş hekimliği. Hemen arayın veya WhatsApp'tan randevu alın.",
  },
  kvkk: {
    companyTitle: "Moda Ağız ve Diş Sağlığı Hizmetleri Ltd. Şti.",
    mersisNo: "0123456789012345",
    dataController: "Moda Ağız ve Diş Sağlığı Hizmetleri Ltd. Şti.",
  },
  /**
   * The direction's motion, copied here by the design stage (D10 §3.2).
   * This reference config is the kinetic language every run before D10 was
   * built in, stated explicitly rather than left to the schema default.
   */
  motion: { profile: "kinetic", heroEntrance: true, smoothScroll: true },
  sellsOnline: false,
  sections: [
    {
      type: "hero",
      id: "hero",
      // photo-full is the archetype that runs the entrance and the pin.
      variant: "photo-full",
      headline: "Kadıköy'de güvenle gülümseyin",
      subheadline:
        "Moda Diş Kliniği'nde modern cihazlar ve deneyimli hekim kadrosuyla ağız ve diş sağlığınız emin ellerde. Aynı gün randevu için hemen arayın.",
      ctaPrimary: { label: "Hemen Ara", action: "tel" },
      ctaSecondary: { label: "WhatsApp'tan Yaz", action: "whatsapp" },
      image: {
        src: "/images/hero-placeholder.svg",
        alt: "Moda Diş Kliniği muayene odası",
      },
    },
    {
      type: "services",
      id: "services",
      variant: "alternating",
      title: "Hizmetlerimiz",
      items: [
        {
          title: "İmplant Tedavisi",
          description:
            "Eksik dişleriniz için uzun ömürlü ve doğal görünümlü implant çözümleri.",
          icon: "tooth",
          image: {
            src: "/images/gallery-2.svg",
            alt: "İmplant tedavisi için hazırlanan muayene ünitesi",
          },
        },
        {
          title: "Diş Beyazlatma",
          description:
            "Tek seansta güvenli ve kalıcı beyazlatma ile daha parlak bir gülüş.",
          icon: "sparkles",
        },
        {
          title: "Ortodonti",
          description:
            "Şeffaf plak ve tel tedavileriyle her yaşta düzgün diş dizilimi.",
          icon: "smile",
          image: {
            src: "/images/gallery-3.svg",
            alt: "Ortodonti tedavisinin yapıldığı sterilizasyon odası",
          },
        },
        {
          title: "Çocuk Diş Hekimliği",
          description:
            "Çocuklarınızın diş hekimi korkusu yaşamadan tedavi olduğu sıcak bir ortam.",
          icon: "baby",
        },
      ],
    },
    {
      type: "team",
      id: "team",
      variant: "portrait-rows",
      title: "Hekim kadromuz",
      intro:
        "Kliniğimizde iki hekim ve bir ağız ve diş sağlığı teknikeri görev yapıyor.",
      members: [
        {
          name: "Dr. Dt. Selin Aydın",
          role: "Kurucu hekim, protez uzmanı",
          bio:
            "Marmara Üniversitesi Diş Hekimliği mezunu. 2009'dan bu yana Kadıköy'de implant ve protez tedavileri uyguluyor.",
          photo: {
            src: "/images/gallery-1.svg",
            alt: "Dr. Dt. Selin Aydın muayene odasında",
          },
        },
        {
          name: "Dt. Mert Kavas",
          role: "Ortodonti",
          bio:
            "Şeffaf plak ve tel tedavilerini yürütüyor; çocuk hastalarla ilgileniyor.",
          photo: {
            src: "/images/gallery-4.svg",
            alt: "Dt. Mert Kavas klinik girişinde",
          },
        },
        {
          name: "Ayça Demir",
          role: "Ağız ve diş sağlığı teknikeri",
        },
      ],
    },
    {
      type: "gallery",
      id: "gallery",
      variant: "default",
      title: "Kliniğimizden Kareler",
      images: [
        { src: "/images/gallery-1.svg", alt: "Klinik bekleme salonu" },
        { src: "/images/gallery-2.svg", alt: "Muayene ünitesi" },
        { src: "/images/gallery-3.svg", alt: "Sterilizasyon odası" },
        { src: "/images/gallery-4.svg", alt: "Klinik girişi" },
      ],
    },
    {
      type: "testimonials",
      id: "testimonials",
      variant: "default",
      title: "Hastalarımız Ne Diyor?",
      items: [
        {
          quote:
            "Yıllardır diş hekimine gitmekten çekiniyordum. Buradaki güler yüzlü ekip sayesinde implant tedavimi rahatça tamamladım.",
          author: "Ayşe K.",
        },
        {
          quote:
            "Oğlumun dolgusu için gittik, doktor hanım o kadar sabırlıydı ki çocuk korkmadan tedavi oldu. Kesinlikle tavsiye ederim.",
          author: "Mehmet T.",
        },
        {
          quote:
            "Diş beyazlatma işlemim tek seansta bitti, sonuçtan çok memnunum. Fiyatlar da gayet makul.",
          author: "Elif S.",
        },
      ],
    },
    {
      type: "faq",
      id: "faq",
      variant: "default",
      title: "Sıkça Sorulan Sorular",
      items: [
        {
          question: "Randevu almak zorunda mıyım?",
          answer:
            "Acil durumlarda randevusuz hastalarımızı da kabul ediyoruz; ancak bekleme yaşamamanız için telefon veya WhatsApp üzerinden randevu almanızı öneririz.",
        },
        {
          question: "İmplant tedavisi ne kadar sürer?",
          answer:
            "Kemik yapınıza bağlı olarak implant tedavisi genellikle 2-4 ay içinde tamamlanır. İlk muayenede size net bir tedavi planı sunarız.",
        },
        {
          question: "Anlaşmalı olduğunuz kurumlar var mı?",
          answer:
            "Özel sağlık sigortalarının çoğuyla anlaşmalıyız. Poliçenizin kapsamını öğrenmek için bizi arayabilirsiniz.",
        },
        {
          question: "Ödeme seçenekleriniz nelerdir?",
          answer:
            "Nakit ve kredi kartı kabul ediyoruz; uygun taksit seçenekleri için kliniğimize danışabilirsiniz.",
        },
      ],
    },
    {
      type: "hours",
      id: "hours",
      variant: "default",
      title: "Çalışma Saatleri",
      note: "Resmi tatillerde kapalıyız. Acil durumlar için WhatsApp hattımızdan ulaşabilirsiniz.",
    },
    {
      type: "contact",
      id: "contact",
      variant: "default",
      title: "İletişim",
      showForm: true,
    },
    {
      type: "marquee",
      id: "marquee",
      variant: "ticker",
      items: ["İmplant Tedavisi", "Diş Beyazlatma", "Ortodonti", "Çocuk Diş Hekimliği"],
    },
    {
      type: "closing",
      id: "closing",
      variant: "statement-cta",
      headline: "Randevunuzu bugün alın",
      body: "Aynı gün muayene için telefonla ulaşabilirsiniz; acil durumlarda randevusuz hastalarımızı da kabul ediyoruz.",
      ctaPrimary: { label: "Hemen Ara", action: "tel" },
    },
    {
      type: "map",
      id: "map",
      variant: "default",
    },
  ],
};

/** Validated at module load — the only export the app consumes. */
export const siteConfig = siteConfigSchema.parse(config);

export default siteConfig;
