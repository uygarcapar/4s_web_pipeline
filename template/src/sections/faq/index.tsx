import type { FaqSection, SiteConfig } from "@/lib/schema";
import { cn } from "cn";

interface FaqProps {
  section: FaqSection;
  config: SiteConfig;
}

/**
 * Frequently asked questions as native <details> disclosures (no JS needed);
 * "compact" variant reduces vertical padding.
 */
export function Faq({ section }: FaqProps) {
  const isCompact = section.variant === "compact";

  return (
    <section id={section.id} className="bg-brand-50/60">
      <div
        className={cn(
          "mx-auto max-w-3xl px-4",
          isCompact ? "py-10" : "py-16",
        )}
      >
        <h2 className="font-heading text-3xl font-semibold text-foreground">
          {section.title ?? "Sıkça Sorulan Sorular"}
        </h2>
        <div className="mt-8 flex flex-col gap-3">
          {section.items.map((item) => (
            <details
              key={item.question}
              className="group rounded-[var(--radius)] border border-brand-100 bg-card px-5 py-4 open:pb-5"
            >
              {/*
                §7: the row is a 44px tap target. `-my-2.5` gives back the
                20px it added, so the closed row occupies the same 24px of
                flow as before and the card's rhythm is unchanged — the hit
                area simply extends into the card's own py-4 padding.
              */}
              <summary className="-my-2.5 flex min-h-11 cursor-pointer list-none items-center text-base font-semibold text-foreground marker:hidden">
                <span className="mr-2 inline-block text-brand-600 transition-transform group-open:rotate-90">
                  ›
                </span>
                {item.question}
              </summary>
              <p className="mt-3 pl-5 text-base text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
