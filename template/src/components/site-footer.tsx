import Link from "next/link";

import { formatPhoneTR, telHref } from "@/lib/format";
import type { SiteConfig } from "@/lib/schema";

/** Turkish weekday names indexed by ISO weekday (1 = Monday). */
const WEEKDAYS_TR: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

/**
 * Closing section, not a legal strip. The business name is set at display
 * scale against the dark ground, with the facts a visitor still needs at the
 * bottom of a long page — address, a pressable number, hours, the profiles
 * the old site advertised — laid out in columns beside it.
 *
 * Everything here is already elsewhere on the page by design: a visitor who
 * scrolled past the contact section should not have to scroll back up.
 */
export function SiteFooter({ config }: { config: SiteConfig }) {
  const { contact, business, socialLinks } = config;

  return (
    <footer className="border-t border-paper-100/15 bg-ink-900 text-paper-200">
      <div className="mx-auto w-full max-w-7xl px-5 pt-[var(--section-y)] pb-24 sm:px-8 md:pb-[var(--section-y)]">
        <p className="t-h2-col text-paper-50">{business.name}</p>

        <div className="mt-14 grid gap-10 border-t border-paper-100/15 pt-10 sm:grid-cols-2 lg:grid-cols-3">
          <section>
            <h2 className="meta text-paper-400">Adres</h2>
            <p className="t-body mt-3 max-w-xs text-paper-200">
              {contact.address}
            </p>
            <p className="t-body text-paper-300">
              {contact.district} / {contact.city}
            </p>
          </section>

          <section>
            <h2 className="meta text-paper-400">İletişim</h2>
            <a
              href={telHref(contact.phoneE164)}
              className="t-h3 mt-3 -my-1 inline-flex min-h-11 items-center whitespace-nowrap text-paper-50 underline-offset-8 hover:underline focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
            >
              {formatPhoneTR(contact.phoneE164)}
            </a>
            <a
              href={`mailto:${contact.email}`}
              className="t-body -my-2 flex min-h-11 items-center break-all text-paper-300 underline-offset-4 hover:text-paper-50 hover:underline focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
            >
              {contact.email}
            </a>
          </section>

          <section>
            <h2 className="meta text-paper-400">Çalışma Saatleri</h2>
            {config.openingHours.length > 0 ? (
              <dl className="mt-3 space-y-1">
                {config.openingHours.map((entry) => (
                  <div key={entry.day} className="flex justify-between gap-6">
                    <dt className="t-body text-paper-300">
                      {WEEKDAYS_TR[entry.day]}
                    </dt>
                    <dd className="t-body tabular-nums text-paper-200">
                      {entry.opens === null
                        ? "Kapalı"
                        : `${entry.opens} – ${entry.closes}`}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              config.hoursNote !== null && (
                <p className="t-h3 mt-3 tabular-nums text-paper-50">
                  {config.hoursNote}
                </p>
              )
            )}
          </section>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-paper-100/15 pt-8 md:flex-row md:items-center md:justify-between">
          <nav
            aria-label="Yasal bağlantılar ve sosyal medya"
            className="flex flex-wrap items-center gap-x-8 gap-y-2"
          >
            <Link
              href="/kvkk-aydinlatma"
              className="btn-label -my-3 inline-flex min-h-11 items-center text-paper-300 underline-offset-8 hover:text-paper-50 hover:underline focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
            >
              KVKK Aydınlatma Metni
            </Link>
            <Link
              href="/cerez-politikasi"
              className="btn-label -my-3 inline-flex min-h-11 items-center text-paper-300 underline-offset-8 hover:text-paper-50 hover:underline focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
            >
              Çerez Politikası
            </Link>
            {socialLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-label -my-3 inline-flex min-h-11 items-center text-paper-300 underline-offset-8 hover:text-paper-50 hover:underline focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
              >
                {link.platform}
              </a>
            ))}
          </nav>

          {business.legalName !== null && (
            <p className="t-body text-paper-400">{business.legalName}</p>
          )}
        </div>
      </div>
    </footer>
  );
}
