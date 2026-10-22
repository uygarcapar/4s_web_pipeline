import { upperTR } from "@/lib/format";
import type { SiteConfig, TeamSection } from "@/lib/schema";

/**
 * Team archetype: **roster** — names and roles as a ruled list, no portraits.
 *
 * Composition from `data/corpus/shots/www-aspensearch-com-.jpg`.
 *
 * **The archetype for a practice that does not photograph its staff**, which
 * is most of them. The alternative the template used to offer was a grid of
 * placeholder silhouettes, which says less than a list and invents more: a
 * visitor learns nothing from six identical grey heads, and §9 is explicit
 * that a person's presentation is not ours to fabricate.
 *
 * Reads as a credits list — role first in the mono accent where the
 * direction has one, then the name at heading size.
 */
export function TeamRoster({ section }: { section: TeamSection; config: SiteConfig }) {
  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <h2
          className="t-h2 max-w-[16ch] text-[var(--ink-900)]"
          style={{ textAlign: "var(--text-align)" as never }}
        >
          {section.title}
        </h2>
        {section.intro !== undefined && (
          <p className="t-lead measure mt-5 text-[var(--ink-700)]">{section.intro}</p>
        )}

        <ul className="mt-10 lg:mt-14">
          {section.members.map((member) => (
            <li
              key={member.name}
              className="grid gap-2 border-t py-6 sm:grid-cols-[14rem_1fr] sm:gap-8"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              <p className="meta text-[var(--ink-400)]">{upperTR(member.role)}</p>
              <div>
                <h3 className="t-h3 text-[var(--ink-900)]">{member.name}</h3>
                {member.bio !== undefined && (
                  <p className="t-body measure mt-3 text-[var(--ink-700)]">{member.bio}</p>
                )}
              </div>
            </li>
          ))}
          <li
            className="border-t"
            style={{
              borderTopWidth: "var(--rule-width)",
              borderTopColor: "var(--rule-color)",
            }}
          />
        </ul>
      </div>
    </section>
  );
}
