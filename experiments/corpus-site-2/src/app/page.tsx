import { Motion } from "@/components/motion";

const SHEETS = [
  {
    n: "01",
    t: "Ölçüm, göz kararından ucuzdur",
    p: "Elli altı site yerel bir tarayıcıda açıldı. getComputedStyle bir stil sayfasının söylemediğini söyler: clamp'in hangi uca oturduğunu, ağırlığın gerçekte kaç olduğunu, tracking'in em cinsinden ne ettiğini.",
    k: "beş katman",
  },
  {
    n: "02",
    t: "Kaynak kod, davranışı anlatmaz",
    p: "CSS bir sitenin ne iddia ettiğini verir; ne yaptığını vermez. Sayfayı dört derinlikte örnekleyip konumla kaydırma arasındaki ilişkiye bakmak gerekti — ve ilk sığ okumam yanlış çıktı.",
    k: "dört derinlik",
  },
  {
    n: "03",
    t: "Korpus her yerde doğru model değil",
    p: "Medyan bir megabayt JavaScript gönderiyor, üçte ikisi WebGL çalıştırıyor, neredeyse üçte biri AA kontrastını geçemiyor. Bunlar stüdyo bağlantısında ölçülen vitrinler.",
    k: "üç itiraz",
  },
  {
    n: "04",
    t: "Aynı veriden iki ayrı site",
    p: "Bu sayfa ile bir öncekinin ölçümleri aynı. Biri grotesk'i 400'de, koyu zeminde, kırpma ve yanal yolculukla okudu; bu serif'i 700'de, açık zeminde, derinlik ve yığınla. Dağılımın içinde başka bir nokta seçmek, kopya olmamanın yolu.",
    k: "iki okuma",
  },
];

const FIGURES = [
  { n: 56, l: "ölçülen site" },
  { n: 34, l: "sabitleme kullanan" },
  { n: 46, l: "filter tween eden" },
  { n: 13, l: "metni bölen" },
];

export default function Page() {
  return (
    <Motion>
      <main>
        {/* Masthead — pinned, but spent on scale and a drawn rule rather than
            on a wipe. Site one used its pin differently. */}
        <section
          data-head
          className="flex min-h-svh flex-col justify-end overflow-hidden px-5 pb-10 sm:px-8"
        >
          <span className="meta">İkinci okuma</span>
          <h1 data-title className="t-display mt-6 max-w-4xl origin-bottom-left">
            Aynı ölçüm,
            <br />
            başka bir kol.
          </h1>
          <div data-rule aria-hidden className="mt-10 h-px w-full bg-ink" />
          <p data-sub className="t-lead mt-6 max-w-xl text-ink-soft">
            Elli altı ödüllü site beş katmanda ölçüldü. Bu sayfa o ölçümün,
            bir öncekinden kasıtlı olarak farklı okunmuş hâli.
          </p>
        </section>

        {/* Depth — three bands at three rates. */}
        <section className="relative overflow-hidden bg-paper-warm py-(--section-y)">
          <div
            data-depth="18"
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-2xl"
          />
          <div
            data-depth="9"
            aria-hidden
            className="pointer-events-none absolute top-1/3 right-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
          />
          <div className="relative px-5 sm:px-8">
            <h2 className="t-h2 max-w-2xl">
              Derinlik, bir şeyin daha yavaş gitmesidir.
            </h2>
            <dl className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {FIGURES.map((f) => (
                <div key={f.l}>
                  <dd
                    data-count={f.n}
                    className="t-display block text-accent tabular-nums"
                    style={{ fontSize: "clamp(2.5rem,6vw,4.5rem)" }}
                  >
                    {f.n}
                  </dd>
                  <dt className="meta mt-2">{f.l}</dt>
                </div>
              ))}
            </dl>
          </div>
          <div
            data-depth="4"
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-[28rem] bg-accent/5 blur-2xl"
          />
        </section>

        {/* The stack — each sheet holds while the next rides over it. */}
        <section data-stack className="px-5 py-(--section-y) sm:px-8">
          <span className="meta">Dört tespit</span>
          <div className="mt-10 grid gap-8">
            {SHEETS.map((s) => (
              <article
                key={s.n}
                className="stack-item sheet sticky top-24 grid gap-6 p-7 sm:p-10 lg:grid-cols-[6rem_1fr_8rem]"
              >
                <span className="meta tabular-nums text-accent">{s.n}</span>
                <div>
                  <h3 className="t-h2 max-w-2xl">{s.t}</h3>
                  <p className="t-lead mt-5 max-w-2xl text-ink-soft">{s.p}</p>
                </div>
                <span className="meta lg:text-right">{s.k}</span>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-rule px-5 py-14 sm:px-8">
          <p className="t-h2 max-w-xl">Ölçülmüş, kopyalanmış değil.</p>
          <p className="meta mt-6">
            pin 34/56 · parallax 31/56 · scale 17/56 · serif display 700
          </p>
        </footer>
      </main>
    </Motion>
  );
}
