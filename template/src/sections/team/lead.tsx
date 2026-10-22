import Image from "next/image";

import type { SiteConfig, TeamSection } from "@/lib/schema";

/**
 * Team archetype: **lead** — one person large, the rest small beneath.
 *
 * Composition from `data/corpus/shots/www-trevornoah-com-.jpg` and
 * `huyml-co-.jpg`.
 *
 * **For a practice that is one person plus support**, which is the common
 * Turkish SMB shape: a named dentist with two assistants, a master tiler
 * with a crew. A grid flattens that into six equal faces and loses the thing
 * a visitor is actually looking for — whose practice is this. The first
 * member in the config leads, because the plan stage orders them from the
 * client's own page rather than guessing.
 *
 * With a single member it is a portrait and a biography, which is correct
 * rather than degenerate: a sole practitioner's team section *is* that.
 */
export function TeamLead({ section }: { section: TeamSection; config: SiteConfig }) {
  const [lead, ...rest] = section.members;
  if (lead === undefined) return null;

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <h2
          className="t-h2 max-w-[16ch] text-[var(--ink-900)]"
          style={{ textAlign: "var(--text-align)" as never }}
        >
          {section.title}
        </h2>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
          <div
            className="relative w-full overflow-hidden"
            style={{
              aspectRatio: "var(--image-aspect)" as never,
              borderRadius: "var(--image-radius)",
              background: "var(--paper-50)",
            }}
          >
            {lead.photo !== undefined && (
              <Image
                src={lead.photo.src}
                alt={lead.photo.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            )}
          </div>

          <div>
            <h3 className="t-h2-col text-[var(--ink-900)]">{lead.name}</h3>
            <p className="meta mt-3 text-[var(--ink-600)]">{lead.role}</p>
            {lead.bio !== undefined && (
              <p className="t-lead measure mt-6 text-[var(--ink-700)]">{lead.bio}</p>
            )}
          </div>
        </div>

        {rest.length > 0 && (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((member) => (
              <li
                key={member.name}
                className="border-t pt-5"
                style={{
                  borderTopWidth: "var(--rule-width)",
                  borderTopColor: "var(--rule-color)",
                }}
              >
                <h4 className="t-h3 text-[var(--ink-900)]">{member.name}</h4>
                <p className="meta mt-2 text-[var(--ink-600)]">{member.role}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
