import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRunState, openStore, type DesignSpec, type Store } from "@pipeline/core";

import { dropSignatureVariant, signatureStage } from "./signature.js";
import { DIRECTIONS } from "../design/directions/index.js";
import { sampleSpec } from "../design/sample-spec.js";
import type { StageContext } from "./types.js";

/**
 * The paths through the §9 stage that must not cost a dollar to be sure of:
 * the skip, the missing slot, and the fallback's two halves.
 *
 * The loop itself needs a model and a browser, so it is not exercised here.
 * What is exercised is everything that decides *whether* the loop runs and
 * what happens when it does not converge — which is where a bug would cost a
 * client a broken page rather than a boring one.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function makeCtx(runDir: string, store: Store): StageContext {
  return {
    domain: "ornek.com.tr",
    url: "https://ornek.com.tr",
    runDir,
    repoRoot: REPO_ROOT,
    state: createRunState({
      domain: "ornek.com.tr",
      url: "https://ornek.com.tr",
      source: "manual",
    }),
    store,
    log: () => {},
  };
}

function specWith(sections: DesignSpec["sections"], index: number): DesignSpec {
  return {
    ...sampleSpec(DIRECTIONS["kinetic-bold"]!, "ornek.com.tr", 0),
    sections,
    signature: { sectionIndex: index, concept: "the client's sentence, large" },
  };
}

function seed(runDir: string, spec: DesignSpec, config: string): void {
  mkdirSync(join(runDir, "design"), { recursive: true });
  mkdirSync(join(runDir, "generate", "src", "sections", "signature"), { recursive: true });
  writeFileSync(join(runDir, "design", "design.json"), JSON.stringify(spec));
  writeFileSync(
    join(runDir, "generate", "src", "sections", "signature", "custom.tsx"),
    "export function SignatureCustom() { return null; }\n",
  );
  writeFileSync(join(runDir, "generate", "site.config.ts"), config);
}

const CONFIG_WITH_SIGNATURE = `export const siteConfig = {
  sections: [
    {
      id: "hero",
      type: "hero",
      variant: "photo-full",
      headline: "Kadıköy'de güvenle gülümseyin",
    },
    {
      id: "signature",
      type: "signature",
      variant: "custom",
      concept: "the client's sentence, large",
      text: "Yirmi yıldır aynı sokaktayız.",
    },
    { id: "contact", type: "contact", variant: "default", showForm: false },
  ],
};
`;

describe("signature stage", () => {
  let dir: string;
  let store: Store;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "signature-"));
    store = openStore({ memory: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("fails when the design stage has not run", async () => {
    mkdirSync(join(dir, "generate"), { recursive: true });
    const result = await signatureStage.run(makeCtx(dir, store));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("design.json");
  });

  /**
   * A client with no vouched sentence gets no signature section, and that is
   * a decision rather than a failure — there is nothing to write markup
   * about without their own words.
   */
  it("skips, without failing, when the spec has no signature section", async () => {
    const spec = specWith(
      [
        { type: "hero", archetype: "photo-full" },
        { type: "services", archetype: "rail-pinned" },
        { type: "contact", archetype: "default" },
      ],
      0,
    );
    seed(dir, spec, "export const siteConfig = { sections: [] };\n");

    const result = await signatureStage.run(makeCtx(dir, store));
    expect(result.ok).toBe(true);
    expect(result.data?.built).toBe(false);

    const written = JSON.parse(
      readFileSync(join(dir, "signature", "result.json"), "utf8"),
    ) as { reason: string };
    expect(written.reason).toContain("no signature section");
  });

  it("fails loudly when the registered slot is missing", async () => {
    const spec = specWith(
      [
        { type: "hero", archetype: "photo-full" },
        { type: "signature", archetype: "custom" },
        { type: "contact", archetype: "default" },
      ],
      1,
    );
    mkdirSync(join(dir, "design"), { recursive: true });
    mkdirSync(join(dir, "generate"), { recursive: true });
    writeFileSync(join(dir, "design", "design.json"), JSON.stringify(spec));

    const result = await signatureStage.run(makeCtx(dir, store));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("slot missing");
  });
});

/**
 * The fallback's config edit, isolated.
 *
 * It must drop the variant from the SIGNATURE section and from nothing
 * else. The first version of this was a regex anchored on `type:
 * "signature"` with a 400-character window, and it looked contained until a
 * signature section with no variant let the match run past the closing brace
 * and strip the NEXT section's. The last test here is that case.
 */
describe("dropSignatureVariant", () => {
  it("removes the signature's variant", () => {
    const after = dropSignatureVariant(CONFIG_WITH_SIGNATURE);
    expect(after).not.toContain('variant: "custom"');
  });

  it("leaves every other section's variant alone", () => {
    const after = dropSignatureVariant(CONFIG_WITH_SIGNATURE);
    expect(after).toContain('variant: "photo-full"');
    expect(after).toContain('variant: "default"');
  });

  it("keeps the signature section itself", () => {
    const after = dropSignatureVariant(CONFIG_WITH_SIGNATURE);
    expect(after).toContain('type: "signature"');
    expect(after).toContain("Yirmi yıldır aynı sokaktayız.");
  });

  it("does nothing to a config with no signature section", () => {
    const plain = `export const siteConfig = {
  sections: [{ id: "hero", type: "hero", variant: "custom" }],
};
`;
    expect(dropSignatureVariant(plain)).toBe(plain);
  });

  /** The bug the regex had. */
  it("does not reach into the next section when the signature has no variant", () => {
    const source = `export const siteConfig = {
  sections: [
    {
      id: "signature",
      type: "signature",
      concept: "x",
      text: "Yirmi yıldır aynı sokaktayız.",
    },
    {
      id: "closing",
      type: "closing",
      variant: "custom",
      headline: "Ara",
    },
  ],
};
`;
    expect(dropSignatureVariant(source)).toBe(source);
  });

  it("survives a section carrying nested objects", () => {
    const source = `export const siteConfig = {
  sections: [
    {
      id: "signature",
      type: "signature",
      variant: "custom",
      text: "Yirmi yıldır aynı sokaktayız.",
      images: [{ src: "/images/crawl/1.jpg", alt: "Klinik" }],
      cta: { label: "Ara", action: "tel" },
    },
    { id: "closing", type: "closing", variant: "banner", headline: "Ara" },
  ],
};
`;
    const after = dropSignatureVariant(source);
    expect(after).not.toContain('variant: "custom"');
    expect(after).toContain('variant: "banner"');
    expect(after).toContain('alt: "Klinik"');
  });
});
