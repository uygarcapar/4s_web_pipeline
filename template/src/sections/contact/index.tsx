import { Button, buttonVariants } from "@/components/ui/button";
import { telHref, waHref } from "@/lib/format";
import type { ContactSection, SiteConfig } from "@/lib/schema";
import { cn } from "cn";

interface ContactProps {
  section: ContactSection;
  config: SiteConfig;
}

/**
 * Contact details plus an optional form. The site has no backend: the form
 * submits via mailto (opens the visitor's e-mail app), and direct tel /
 * WhatsApp buttons are always offered as the primary path.
 */
export function Contact({ section, config }: ContactProps) {
  const { contact } = config;
  const isSplit = section.variant === "split";

  return (
    <section id={section.id} className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="font-heading text-3xl font-semibold text-foreground">
        {section.title ?? "İletişim"}
      </h2>
      <div
        className={cn(
          "mt-8 grid gap-10",
          (section.showForm || isSplit) && "md:grid-cols-2",
        )}
      >
        <div className="flex flex-col gap-4 text-base">
          <p className="text-muted-foreground">
            {contact.address}, {contact.district} / {contact.city}
          </p>
          <dl className="flex flex-col gap-2">
            <div className="flex gap-2">
              <dt className="font-semibold text-foreground">Telefon:</dt>
              <dd>
                <a
                  href={telHref(contact.phoneE164)}
                  className="-my-3 inline-flex min-h-11 items-center text-brand-700 underline-offset-4 hover:underline"
                >
                  {contact.phoneE164}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-foreground">E-posta:</dt>
              <dd>
                <a
                  href={`mailto:${contact.email}`}
                  className="-my-3 inline-flex min-h-11 items-center text-brand-700 underline-offset-4 hover:underline"
                >
                  {contact.email}
                </a>
              </dd>
            </div>
          </dl>
          <div className="mt-2 flex flex-wrap gap-3">
            <a
              href={telHref(contact.phoneE164)}
              className={cn(buttonVariants({ size: "lg" }), "px-5")}
            >
              Hemen Ara
            </a>
            {contact.whatsappE164 !== null && (
              <a
                href={waHref(
                  contact.whatsappE164,
                  "Merhaba, randevu almak istiyorum.",
                )}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "px-5",
                )}
              >
                WhatsApp&apos;tan Yaz
              </a>
            )}
          </div>
        </div>
        {section.showForm && (
          <form
            action={`mailto:${contact.email}`}
            method="post"
            encType="text/plain"
            className="flex flex-col gap-4 rounded-[var(--radius)] border border-brand-100 bg-card p-6"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact-name" className="text-sm font-semibold">
                Adınız Soyadınız
              </label>
              <input
                id="contact-name"
                name="ad-soyad"
                type="text"
                required
                className="rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact-phone" className="text-sm font-semibold">
                Telefonunuz
              </label>
              <input
                id="contact-phone"
                name="telefon"
                type="tel"
                className="rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact-message" className="text-sm font-semibold">
                Mesajınız
              </label>
              <textarea
                id="contact-message"
                name="mesaj"
                rows={4}
                required
                className="rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <Button type="submit" size="lg">
              Gönder
            </Button>
            <p className="text-xs text-muted-foreground">
              Form, mesajınızı e-posta uygulamanız üzerinden iletir. Dilerseniz
              bize doğrudan telefon veya WhatsApp ile de ulaşabilirsiniz.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
