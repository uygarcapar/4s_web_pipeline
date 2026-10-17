import Link from "next/link";

import type { SiteConfig } from "@/lib/schema";

/** Footer with business identity and links to the legal pages. */
export function SiteFooter({ config }: { config: SiteConfig }) {
  return (
    <footer className="border-t border-brand-100 bg-brand-950 text-brand-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 pb-24 text-sm md:pb-10">
        <p className="font-heading text-lg font-semibold text-brand-50">
          {config.business.name}
        </p>
        <p>
          {config.contact.address}, {config.contact.district} /{" "}
          {config.contact.city}
        </p>
        <p>{config.business.legalName}</p>
        <nav aria-label="Yasal bağlantılar" className="flex flex-wrap gap-4">
          <Link
            href="/kvkk-aydinlatma"
            className="underline underline-offset-4"
          >
            KVKK Aydınlatma Metni
          </Link>
          <Link
            href="/cerez-politikasi"
            className="underline underline-offset-4"
          >
            Çerez Politikası
          </Link>
        </nav>
      </div>
    </footer>
  );
}
