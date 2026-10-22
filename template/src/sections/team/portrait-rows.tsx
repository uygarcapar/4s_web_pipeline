import Image from "next/image";

import { upperTR } from "@/lib/format";
import type { SiteConfig, TeamSection } from "@/lib/schema";

/**
 * Team archetype: **portrait rows** — one person per full-width row,
 * portrait and biography side by side, sides alternating.
 *
 * Composition from `data/corpus/shots/lxlcreative-co-uk-.jpg`.
 *
 * **For a small practice whose people have something to say.** Where `grid`
 * answers "who works here" at a glance, this gives each person the room for
 * a real biography — the three-doctor clinic whose about page has a
 * paragraph each. Past five or six members it becomes a long page and
 * `grid` or `roster` is the better pick; the selector should weigh member
 * count, not just photo availability.
 *
 * Alternation counts **portrayed** rows, not all rows — the bug
 * `services/alternating` shipped with first: members photographed at
 * positions 0 and 2 would otherwise both land left and the page would stop
 * alternating.
 */
export function TeamPortraitRows({
  section,
}: {
  section: TeamSection;
  config: SiteConfig;
}) {
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

        <ul className="mt-10 lg:mt-14">
          {section.members.map((member, i) => {
            const portrayedBefore = section.members
              .slice(0, i)
              .filter((earlier) => earlier.photo !== undefined).length;
            return (
              <li
                key={member.name}
                className="grid gap-8 border-t py-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-14"
                style={{
                  borderTopWidth: "var(--rule-width)",
                  borderTopColor: "var(--rule-color)",
                }}
              >
                {member.photo !== undefined && (
                  <div
                    className={`relative w-full overflow-hidden ${
                      portrayedBefore % 2 === 1 ? "lg:order-last" : ""
                    }`}
                    style={{
                      aspectRatio: "var(--image-aspect)" as never,
                      borderRadius: "var(--image-radius)",
                    }}
                  >
                    <Image
                      src={member.photo.src}
                      alt={member.photo.alt}
                      fill
                      loading="lazy"
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className={member.photo === undefined ? "lg:col-span-2" : ""}>
                  <p className="meta text-[var(--ink-400)]">{upperTR(member.role)}</p>
                  <h3 className="t-h2-col mt-3 text-[var(--ink-900)]">{member.name}</h3>
                  {member.bio !== undefined && (
                    <p className="t-body measure mt-5 text-[var(--ink-700)]">
                      {member.bio}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
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
