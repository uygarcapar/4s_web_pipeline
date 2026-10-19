/**
 * Case- and diacritic-folding for matching slugs and titles against ASCII
 * keywords.
 *
 * Plain `toLowerCase()` is banned project-wide because it breaks Turkish
 * İ/ı — but `toLocaleLowerCase("tr-TR")` alone is not enough here either:
 * it turns "HIZMETLERIMIZ" into "hızmetlerımız", which then fails to match
 * the keyword "hizmet". Matching wants the *letters*, not the casing rules,
 * so Turkish-specific characters are folded to their ASCII shapes after the
 * locale-aware lowercase.
 *
 * This is for comparison only. Never render a folded string — it is not
 * Turkish any more.
 */
const FOLD: Record<string, string> = {
  ı: "i",
  i: "i",
  ş: "s",
  ğ: "g",
  ç: "c",
  ö: "o",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

export function foldForMatch(input: string): string {
  const lowered = input.toLocaleLowerCase("tr-TR");
  let out = "";
  for (const ch of lowered) out += FOLD[ch] ?? ch;
  return out;
}
