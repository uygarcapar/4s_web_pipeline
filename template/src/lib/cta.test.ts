import { describe, expect, it } from "vitest";

import { resolveCta, resolveCtaHref } from "./cta.js";
import { siteConfigSchema, type Cta, type SiteConfigInput } from "./schema.js";
import { nullWhatsappConfig } from "../../fixtures/null-whatsapp.config.js";
import { siteConfig } from "../../site.config.js";

const WHATSAPP_CTA: Cta = { label: "WhatsApp'tan Yaz", action: "whatsapp" };

describe("resolveCta — D8 degradation", () => {
  it("keeps the wa.me href and the label when a number is published", () => {
    const r = resolveCta(WHATSAPP_CTA, siteConfig);
    expect(r.href).toMatch(/^https:\/\/wa\.me\/90\d{10}$/);
    expect(r.label).toBe("WhatsApp'tan Yaz");
  });

  /**
   * The bug this test exists for: only the href used to degrade, leaving a
   * button that read "WhatsApp'tan Yaz" and dialled the phone. No gate could
   * catch it — the href is valid, and the label is content.
   */
  it("degrades the label as well as the href when no number is published", () => {
    const r = resolveCta(WHATSAPP_CTA, nullWhatsappConfig);
    expect(r.href).toBe(`tel:${nullWhatsappConfig.contact.phoneE164}`);
    expect(r.label).not.toMatch(/whatsapp/i);
    expect(r.label).toBe("Hemen Ara");
  });

  it("never promises WhatsApp over a tel: href", () => {
    const { href, label } = resolveCta(WHATSAPP_CTA, nullWhatsappConfig);
    expect(href.startsWith("tel:") && /whatsapp/i.test(label)).toBe(false);
  });

  it("leaves tel and link CTAs alone", () => {
    expect(resolveCta({ label: "Ara", action: "tel" }, nullWhatsappConfig)).toEqual({
      href: `tel:${nullWhatsappConfig.contact.phoneE164}`,
      label: "Ara",
    });
    expect(
      resolveCta({ label: "Saatler", action: "link", href: "#hours" }, nullWhatsappConfig),
    ).toEqual({ href: "#hours", label: "Saatler" });
  });

  it("resolveCtaHref still returns just the href", () => {
    expect(resolveCtaHref(WHATSAPP_CTA, nullWhatsappConfig)).toBe(
      `tel:${nullWhatsappConfig.contact.phoneE164}`,
    );
  });
});

/**
 * The first line of defence: the plan stage must not emit a whatsapp action
 * for a business with no number. `generate` writes site.config.ts, so the
 * schema's module-load parse is the boundary that enforces it — a bad plan
 * becomes a build failure rather than a shipped page.
 */
describe("siteConfigSchema — no WhatsApp CTA without a number", () => {
  const withHeroCta = (cta: Cta, whatsapp: string | null): SiteConfigInput => ({
    ...(nullWhatsappConfig as unknown as SiteConfigInput),
    contact: { ...nullWhatsappConfig.contact, whatsappE164: whatsapp },
    sections: [
      {
        type: "hero",
        id: "hero",
        variant: "default",
        headline: "Başlık",
        ctaPrimary: cta,
      },
      ...nullWhatsappConfig.sections.slice(1),
    ],
  });

  it("rejects a whatsapp CTA when whatsappE164 is null", () => {
    const result = siteConfigSchema.safeParse(withHeroCta(WHATSAPP_CTA, null));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("action"));
      expect(issue?.message).toMatch(/whatsappE164 is null/);
    }
  });

  it("accepts the same CTA once a number is published", () => {
    expect(
      siteConfigSchema.safeParse(withHeroCta(WHATSAPP_CTA, "+905321234567")).success,
    ).toBe(true);
  });

  it("accepts a tel CTA with no number published", () => {
    expect(
      siteConfigSchema.safeParse(withHeroCta({ label: "Hemen Ara", action: "tel" }, null))
        .success,
    ).toBe(true);
  });

  it("the committed fixture is itself valid", () => {
    expect(nullWhatsappConfig.contact.whatsappE164).toBeNull();
    expect(
      nullWhatsappConfig.sections.every(
        (s) =>
          s.type !== "hero" ||
          (s.ctaPrimary.action !== "whatsapp" && s.ctaSecondary?.action !== "whatsapp"),
      ),
    ).toBe(true);
  });
});
