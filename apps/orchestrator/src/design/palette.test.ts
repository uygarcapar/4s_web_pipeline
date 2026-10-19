import { describe, expect, it } from "vitest";
import { buildPalette, derivePalette, dominantHue } from "./palette.js";

/** Build a flat RGB buffer by repeating one colour. */
function fill(r: number, g: number, b: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(r, g, b);
  return out;
}

describe("dominantHue", () => {
  it("ignores the white room and finds the equipment's colour", () => {
    // a dental surgery: mostly white cabinetry, one turquoise chair
    const rgb = [...fill(248, 249, 250, 900), ...fill(0, 150, 160, 100)];
    const { hue, chroma } = dominantHue([{ rgb }]);
    expect(hue).toBeGreaterThan(170);
    expect(hue).toBeLessThan(200);
    expect(chroma).toBeGreaterThan(0.5);
  });

  it("ignores shadow as well as highlight", () => {
    const rgb = [...fill(4, 4, 5, 800), ...fill(200, 90, 30, 200)];
    const { hue } = dominantHue([{ rgb }]);
    expect(hue).toBeGreaterThan(10);
    expect(hue).toBeLessThan(40);
  });

  it("falls back to a warm neutral when nothing is saturated", () => {
    const { hue, chroma } = dominantHue([{ rgb: fill(130, 130, 130, 500) }]);
    expect(chroma).toBe(0);
    expect(hue).toBe(38);
  });

  it("weights the client's own photographs above stock ones", () => {
    const own = { rgb: fill(0, 150, 160, 100), weight: 5 }; // turquoise room
    const stock = { rgb: fill(200, 60, 60, 100), weight: 1 }; // red stock photo
    const { hue } = dominantHue([own, stock]);
    expect(hue).toBeGreaterThan(150);
  });

  it("is deterministic — the same pixels give the same answer", () => {
    const rgb = [...fill(0, 150, 160, 100), ...fill(190, 140, 60, 60)];
    expect(dominantHue([{ rgb }])).toEqual(dominantHue([{ rgb }]));
  });
});

describe("buildPalette", () => {
  it("puts the source hue into the darks, not just the accent", () => {
    const p = buildPalette({ hue: 178, chroma: 0.6 });
    expect(p.name).toBe("turkuaz");
    // ink-900 must be a near-black that still carries the hue
    expect(p.ink[900]).toMatch(/^#[0-9a-f]{6}$/);
    expect(p.ink[900]).not.toBe("#000000");
    expect(p.accent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("gives two different businesses two different palettes", () => {
    const clinic = buildPalette({ hue: 178, chroma: 0.6 }); // turquoise chair
    const kebab = buildPalette({ hue: 24, chroma: 0.55 }); // copper and char
    expect(clinic.ink[900]).not.toBe(kebab.ink[900]);
    expect(clinic.accent).not.toBe(kebab.accent);
    expect(clinic.name).not.toBe(kebab.name);
  });

  it("keeps the papers warm even when the source hue is cold", () => {
    const cold = buildPalette({ hue: 215, chroma: 0.6 });
    // a page is read on paper: the background must not turn blue
    expect(cold.paper[100]).not.toBe(cold.ink[900]);
    const r = parseInt(cold.paper[100].slice(1, 3), 16);
    const b = parseInt(cold.paper[100].slice(5, 7), 16);
    expect(r).toBeGreaterThanOrEqual(b);
  });

  it("falls back to a warm neutral family when the photographs have no colour", () => {
    const p = buildPalette({ hue: 38, chroma: 0 });
    expect(p.name).toBe("nötr");
  });

  it("emits six papers and five inks, all valid hex", () => {
    const p = derivePalette([{ rgb: fill(0, 150, 160, 50) }]);
    for (const v of [...Object.values(p.paper), ...Object.values(p.ink), p.accent]) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
