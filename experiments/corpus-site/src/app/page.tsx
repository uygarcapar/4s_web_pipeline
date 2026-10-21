import { Choreography } from "@/components/choreography";
import { Marquee, Nav } from "@/components/blocks";

/** Act 2 swaps one word at a time — the sentence changes, it does not move. */
const SWAP = ["sabitlenir", "silinir", "bulanır", "yana akar", "netleşir"];

const TRAVEL = [
  { n: "01", t: "Sabitleme", d: "Bölüm yerinde kalır, içerik onun içinden geçer." },
  { n: "02", t: "Kırpma", d: "Solmak yerine silinerek açılır — kenar keskin kalır." },
  { n: "03", t: "Bulanıklık", d: "Odağa gelen blok netleşir, gerideki geri çekilir." },
  { n: "04", t: "Derinlik", d: "Fotoğraf, taşıdığı kartla aynı hızda gitmez." },
  { n: "05", t: "Yanal", d: "Dikey girdi, yatay yolculuk. Azınlık yöntem, bir kez." },
];

const FOCUS = [
  {
    h: "Bulanıklık bir geçiş değil, bir mesafedir.",
    p: "Odağa gelmemiş blok geride durur. Yaklaştıkça netleşir — solup belirmez, yaklaşır.",
  },
  {
    h: "Kırpma, solmanın yapamadığını yapar.",
    p: "Soluk bir kenar yoktur; blok bir perde gibi açılır ve kenarı keskin kalır.",
  },
  {
    h: "Sabitleme, zamanı kaydırmaya bağlar.",
    p: "Bölüm yerinde kalırken içerik ilerler. Kaydırma hız değil, konum olur.",
  },
];

export default function Page() {
  return (
    <Choreography>
      <Nav
        links={[
          { href: "#swap", label: "Dönüşüm" },
          { href: "#travel", label: "Yolculuk" },
          { href: "#focus", label: "Odak" },
        ]}
      />

      <main id="top">
        {/* ACT 1 — pinned, then wiped and pushed back. */}
        <section
          data-act="open"
          className="relative flex min-h-svh flex-col justify-between overflow-hidden px-5 py-6 sm:px-8"
        >
          <div className="flex items-baseline justify-between">
            <span className="meta">Kaydırma koreografisi</span>
            <span className="meta">beş hareket</span>
          </div>

          <h1 className="t-display max-w-5xl py-10">
            {["Kaydırmak", "bir şeyi", "değiştirmeli."].map((line) => (
              <span key={line} className="block overflow-hidden">
                <span data-line className="block">
                  {line}
                </span>
              </span>
            ))}
          </h1>

          <p className="t-lead max-w-lg text-ink-soft">
            Sayfayı aşağı itmek hareket değildir. Hareket, sayfanın itildikçe
            başka bir şey olmasıdır.
          </p>

          {/* The plate that wipes up behind the statement as it leaves. */}
          <div
            data-plate
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-paper-dim"
          />
        </section>

        <Marquee words={["sabitle", "kırp", "bulanıklaştır", "kaydır", "netleştir"]} />

        {/* ACT 2 — the sentence transforms in place. */}
        <section
          id="swap"
          data-act="swap"
          className="flex min-h-svh flex-col justify-center overflow-hidden px-5 sm:px-8"
        >
          <span className="meta">İkinci hareket · dönüşüm</span>
          <p className="t-display mt-8 max-w-4xl">
            Metin{" "}
            <span className="relative inline-block align-top text-accent">
              {SWAP.map((w, i) => (
                <span
                  key={w}
                  data-swap
                  // The alternates are the same claim said five ways, not five
                  // separate facts, so hiding them costs a reduced-motion
                  // visitor nothing — and leaving them visible would stack
                  // five words on one line when no timeline runs.
                  aria-hidden={i > 0}
                  className={
                    i === 0 ? "block" : "swap-alt absolute top-0 left-0 block whitespace-nowrap"
                  }
                >
                  {w}
                </span>
              ))}
            </span>
          </p>
          <p className="t-lead mt-10 max-w-xl text-ink-soft">
            Kelimenin yerini bir sonraki alır. Cümle aynı yerde durur; değişen
            şey cümlenin kendisidir.
          </p>
        </section>

        {/* ACT 3 — vertical input, lateral travel. */}
        <section
          id="travel"
          data-act="travel"
          className="flex min-h-svh flex-col justify-center overflow-hidden"
        >
          <span className="meta px-5 sm:px-8">Üçüncü hareket · yanal</span>
          <div data-track className="mt-10 flex w-max gap-6 px-5 sm:px-8">
            {TRAVEL.map((c) => (
              <article key={c.n} className="w-[78vw] shrink-0 sm:w-[46vw] lg:w-[30vw]">
                <div className="relative aspect-4/3 overflow-hidden bg-paper-dim">
                  <div
                    data-depth
                    aria-hidden
                    className="absolute inset-0 -left-[12%] w-[124%] bg-[radial-gradient(60%_80%_at_30%_30%,var(--brand-accent)_0%,transparent_70%)] opacity-60"
                  />
                </div>
                <div className="rule-top mt-5 flex items-baseline gap-4 pt-4">
                  <span className="meta tabular-nums text-accent">{c.n}</span>
                  <h2 className="t-h2">{c.t}</h2>
                </div>
                <p className="mt-3 text-ink-soft">{c.d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ACT 4 — focus pulled by scroll. */}
        <section id="focus" className="px-5 py-(--section-y) sm:px-8">
          <span className="meta">Dördüncü hareket · odak</span>
          <div className="mt-12 grid gap-px bg-rule">
            {FOCUS.map((b) => (
              <article key={b.h} data-focus className="bg-paper py-12">
                <h2 className="t-h2 max-w-3xl text-balance">{b.h}</h2>
                <p className="t-lead mt-5 max-w-2xl text-ink-soft">{b.p}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rule-top bg-paper-dim px-5 py-(--section-y) sm:px-8">
          <div data-wipe>
            <span className="meta">Beşinci hareket · kapanış</span>
            <h2 className="t-display mt-8 max-w-4xl">Aşağı inmek değil, ilerlemek.</h2>
          </div>
        </section>

        <footer className="rule-top flex flex-col gap-6 px-5 py-14 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <p className="t-h2 max-w-md">Hareketin tamamı ölçümden.</p>
          <p className="meta max-w-xs sm:text-right">
            pin 34/56 · filter 46/57 · clip 13/56 · scrub ease:none
          </p>
        </footer>
      </main>
    </Choreography>
  );
}
