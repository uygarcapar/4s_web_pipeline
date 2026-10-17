import { SectionRenderer } from "@/sections/section-renderer";
import { siteConfig } from "~config";

/** Single-page site: renders the ordered sections from site.config.ts. */
export default function Home() {
  return (
    <main>
      <SectionRenderer config={siteConfig} />
    </main>
  );
}
