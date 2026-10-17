import type { SiteConfig } from "@/lib/schema";
import { getSectionComponent } from "@/sections/registry";

/**
 * Renders `config.sections` in order through the section registry.
 * Section `id`s double as React keys and anchor targets.
 */
export function SectionRenderer({ config }: { config: SiteConfig }) {
  return (
    <>
      {config.sections.map((section) => {
        const Section = getSectionComponent(section.type);
        return <Section key={section.id} section={section} config={config} />;
      })}
    </>
  );
}
