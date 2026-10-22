import Image from "next/image";

import { resolveCta } from "@/lib/cta";
import type { SignatureSection, SiteConfig } from "@/lib/schema";

/**
 * The signature section's **default** — what ships when the §9 loop does not
 * produce something better.
 *
 * D10 §9 says the signature loop falls back to the direction's default
 * archetype for that slot and never blocks a run for taste alone. This is
 * that floor, so it is deliberately a real section rather than a
 * placeholder: a client whose bespoke element failed to converge still gets
 * their own sentence at display scale against their best photograph, which
 * is a perfectly good section. It is simply not a *bold* one.
 *
 * Everything it renders comes from the config, so it inherits the same
 * guarantee the rest of the library has: it cannot state a fact of its own.
 */
export function Signature({
  section,
  config,
}: {
  section: SignatureSection;
  config: SiteConfig;
}) {
  const picture = section.images[0];
  const cta = section.cta ? resolveCta(section.cta, config) : null;

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
        <div
          className="flex flex-col justify-center lg:col-span-7"
          style={{ textAlign: "var(--text-align)" as never }}
        >
          <p className="t-h2 text-[var(--ink-900)]">{section.text}</p>

          {cta !== null && (
            <div className="mt-10">
              <a
                href={cta.href}
                className="btn-label inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius)] bg-[var(--brand-accent)] px-6 text-[var(--paper-50)] focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
              >
                {cta.label}
              </a>
            </div>
          )}
        </div>

        {picture !== undefined && (
          <div className="lg:col-span-5">
            <div
              className="relative overflow-hidden rounded-[var(--image-radius)]"
              style={{ aspectRatio: "var(--image-aspect)" as never }}
            >
              <Image
                src={picture.src}
                alt={picture.alt}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
