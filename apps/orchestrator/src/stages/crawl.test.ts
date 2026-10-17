import { describe, expect, it } from "vitest";
import {
  findAddressCandidates,
  findHoursCandidates,
  findPhoneCandidates,
  hasMojibake,
  normalizeUrl,
  slugForUrl,
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
