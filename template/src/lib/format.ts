/**
 * Turkish-locale formatting helpers.
 *
 * Always use these instead of the default `String.prototype.toUpperCase` /
 * `toLowerCase` (ESLint errors on those): Turkish has dotted/dotless i
 * casing rules ("istanbul" → "İSTANBUL", "ILIK" → "ılık") that the default
 * locale breaks.
 */

const TRY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" });

/**
 * Formats an amount as Turkish lira, e.g. `formatTRY(1250.5)` → `"₺1.250,50"`.
 */
export function formatTRY(amount: number): string {
  return TRY_FORMATTER.format(amount);
}

/**
 * Formats a date in long Turkish style, e.g. `"17 Ekim 2026"`.
 */
export function formatDateTR(date: Date): string {
  return DATE_FORMATTER.format(date);
}

/**
 * Uppercases with Turkish casing rules: `"istanbul"` → `"İSTANBUL"`.
 */
export function upperTR(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}

/**
 * Lowercases with Turkish casing rules: `"IŞIK"` → `"ışık"`.
 */
export function lowerTR(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

/**
 * Normalizes a Turkish phone number in any common local notation to E.164.
 *
 * Accepts inputs like `"0 (532) 123 45 67"`, `"0532 123 45 67"`,
 * `"+90 532 123 45 67"`, `"90 532 123 45 67"` or `"5321234567"` and returns
 * `"+905321234567"`. Returns `null` when the input is not a valid Turkish
 * mobile (5XX) or landline (2XX/3XX/4XX) number.
 */
export function toE164TR(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  let national: string;
  if (digits.length === 12 && digits.startsWith("90")) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else if (digits.length === 10) {
    national = digits;
  } else {
    return null;
  }

  // 10 digits; mobile numbers start with 5, landlines with 2, 3 or 4.
  if (!/^[2345]\d{9}$/.test(national)) {
    return null;
  }

  return `+90${national}`;
}

/**
 * Builds a `tel:` href from an E.164 number: `"tel:+905321234567"`.
 */
export function telHref(phoneE164: string): string {
  return `tel:${phoneE164}`;
}

/**
 * Builds a WhatsApp click-to-chat URL from an E.164 number (wa.me expects no
 * plus sign): `waHref("+905321234567", "Merhaba")` →
 * `"https://wa.me/905321234567?text=Merhaba"`.
 */
export function waHref(phoneE164: string, text?: string): string {
  const number = phoneE164.replace(/^\+/, "");
  const query = text === undefined ? "" : `?text=${encodeURIComponent(text)}`;
  return `https://wa.me/${number}${query}`;
}
