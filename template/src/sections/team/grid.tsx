import Image from "next/image";

import type { SiteConfig, TeamSection } from "@/lib/schema";

/**
 * Team archetype: **grid** — one portrait per cell, name and role beneath.
 *
 * Composition from `data/corpus/shots/lpas-com-.jpg`. The plainest of the
 * team archetypes on purpose: for a practice with six or more people the
 * question a visitor has is "who works here", and a grid answers it in one
 * screen where a stack of rows would not.
 *
 * A member with no portrait gets a `--paper-50` cell carrying their initial
 * rather than a silhouette icon — §9 forbids inventing, and a generic avatar
 * is an invention about a real person's face. The initial is theirs.
 */
export function TeamGrid({ section }: { section: TeamSection; config: SiteConfig }) {
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
        {section.intro !== undefined && (
          <p className="t-lead measure mt-5 text-[var(--ink-700)]">{section.intro}</p>
        )}

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {section.members.map((member) => (
            <li key={member.name}>
              <div
                className="relative w-full overflow-hidden"
                style={{
                  aspectRatio: "var(--image-aspect)" as never,
                  borderRadius: "var(--image-radius)",
                  background: "var(--paper-50)",
                }}
              >
                {member.photo !== undefined ? (
                  <Image
                    src={member.photo.src}
                    alt={member.photo.alt}
                    fill
                    loading="lazy"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="t-display absolute inset-0 flex items-center justify-center text-[var(--ink-400)]">
                    {member.name.slice(0, 1)}
                  </span>
                )}
              </div>
              <h3 className="t-h3 mt-4 text-[var(--ink-900)]">{member.name}</h3>
              {/* Verbatim from their own page; never inferred (§9). */}
              <p className="meta mt-2 text-[var(--ink-600)]">{member.role}</p>
              {member.bio !== undefined && (
                <p className="t-body mt-3 text-[var(--ink-700)]">{member.bio}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
