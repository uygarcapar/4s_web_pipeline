import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "~config";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description: `${siteConfig.business.name} kişisel verilerin korunması aydınlatma metni.`,
};

/*
 * TODO(uygar): This page is a structural placeholder generated from
 * config.kvkk. The final KVKK disclosure text MUST be reviewed and approved
 * by a lawyer before the site goes live for a real client.
 */
export default function KvkkPage() {
  const { kvkk, contact, business } = siteConfig;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold">
        Kişisel Verilerin Korunması Aydınlatma Metni
      </h1>

      <p>
        İşbu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu
        (&quot;KVKK&quot;) uyarınca, veri sorumlusu sıfatıyla hareket eden{" "}
        <strong>{kvkk.dataController}</strong> tarafından hazırlanmıştır.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
          1. Veri Sorumlusu
        </h2>
        <p>
          Ticaret unvanı: <strong>{kvkk.companyTitle}</strong>
        </p>
        {kvkk.mersisNo !== undefined && <p>MERSİS No: {kvkk.mersisNo}</p>}
        <p>
          Adres: {contact.address}, {contact.district} / {contact.city}
        </p>
        <p>E-posta: {contact.email}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
          2. İşlenen Kişisel Veriler ve İşleme Amaçları
        </h2>
        {/* TODO(uygar): Have a lawyer tailor the processed-data categories and
            purposes to the client's actual operations. */}
        <p>
          Web sitemiz üzerinden bize telefon, e-posta veya WhatsApp yoluyla
          ulaştığınızda ad-soyad, telefon numarası ve e-posta adresi gibi
          iletişim verileriniz; randevu oluşturma, talebinizi yanıtlama ve
          iletişim faaliyetlerinin yürütülmesi amaçlarıyla sınırlı olarak
          işlenebilir.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
          3. Kişisel Verilerin Aktarılması
        </h2>
        {/* TODO(uygar): Lawyer must confirm actual transfer recipients. */}
        <p>
          Kişisel verileriniz, yasal yükümlülüklerimizin yerine getirilmesi
          amacıyla yetkili kamu kurum ve kuruluşları dışında üçüncü kişilere
          aktarılmaz.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
          4. Toplama Yöntemi ve Hukuki Sebep
        </h2>
        <p>
          Kişisel verileriniz, web sitemizdeki iletişim kanalları aracılığıyla
          elektronik ortamda; KVKK&apos;nın 5. maddesinde yer alan
          &quot;ilgili kişinin temel hak ve özgürlüklerine zarar vermemek
          kaydıyla, veri sorumlusunun meşru menfaatleri için veri işlenmesinin
          zorunlu olması&quot; hukuki sebebine dayanılarak toplanır.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">
          5. KVKK Kapsamındaki Haklarınız
        </h2>
        <p>
          KVKK&apos;nın 11. maddesi uyarınca; kişisel verilerinizin işlenip
          işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme,
          düzeltilmesini veya silinmesini isteme ve diğer haklarınızı
          kullanmak için {contact.email} adresi üzerinden{" "}
          {business.name} ile iletişime geçebilirsiniz.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        Çerez kullanımına ilişkin ayrıntılar için{" "}
        <Link href="/cerez-politikasi" className="-my-3 inline-flex min-h-11 items-center align-middle underline underline-offset-4">
          Çerez Politikası
        </Link>{" "}
        sayfasını inceleyebilirsiniz.
      </p>

      <p>
        <Link href="/" className="-my-3 inline-flex min-h-11 items-center align-middle underline underline-offset-4">
          ← Ana sayfaya dön
        </Link>
      </p>
    </main>
  );
}
