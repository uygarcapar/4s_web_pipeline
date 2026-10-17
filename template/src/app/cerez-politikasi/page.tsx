import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "~config";

export const metadata: Metadata = {
  title: "Çerez Politikası",
  description: `${siteConfig.business.name} çerez politikası.`,
};

/*
 * TODO(uygar): This page is a structural placeholder generated from
 * config.kvkk. The final cookie policy text MUST be reviewed and approved by
 * a lawyer before the site goes live for a real client.
 */
export default function CookiePolicyPage() {
  const { kvkk, contact } = siteConfig;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold">Çerez Politikası</h1>

      <p>
        Bu çerez politikası, <strong>{kvkk.companyTitle}</strong> tarafından
        işletilen bu web sitesinde kullanılan çerezler hakkında bilgi vermek
        amacıyla hazırlanmıştır.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
          1. Çerez Nedir?
        </h2>
        <p>
          Çerezler, ziyaret ettiğiniz web siteleri tarafından tarayıcınıza
          kaydedilen küçük metin dosyalarıdır. Benzer şekilde, tarayıcınızın
          yerel depolama alanı (localStorage) da tercihlerinizi saklamak için
          kullanılabilir.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
          2. Bu Sitede Kullanılan Çerezler
        </h2>
        {/* TODO(uygar): Lawyer must confirm the cookie inventory below if any
            analytics/marketing service is ever added to the site. */}
        <p>
          Bu sitede analitik veya pazarlama amaçlı hiçbir çerez ya da izleme
          teknolojisi <strong>kullanılmamaktadır</strong>. Yalnızca çerez
          tercihlerinizi hatırlamak için zorunlu nitelikte tek bir kayıt
          (kvkk-consent) tutulur:
        </p>
        <ul className="list-disc pl-6">
          <li>
            <strong>kvkk-consent</strong> (çerez ve localStorage): Çerez
            tercihinize ilişkin kararınızı saklar. Saklama süresi en fazla 6
            aydır.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
          3. Çerez Tercihlerinizi Yönetme
        </h2>
        <p>
          Çerez tercihlerinizi dilediğiniz zaman tarayıcınızın ayarlarından
          veya tarayıcı verilerini temizleyerek değiştirebilirsiniz. Sorularınız
          için {contact.email} adresinden bize ulaşabilirsiniz.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        Kişisel verilerin işlenmesine ilişkin ayrıntılar için{" "}
        <Link href="/kvkk-aydinlatma" className="underline underline-offset-4">
          KVKK Aydınlatma Metni
        </Link>
        ni inceleyebilirsiniz.
      </p>

      <p>
        <Link href="/" className="underline underline-offset-4">
          ← Ana sayfaya dön
        </Link>
      </p>
    </main>
  );
}
