# Tek komutla KOBİ sitesini yeniden kuran Claude Code hattı

**Kısa cevap:** İstediğin otomasyon, tek bir "akıllı ajan" olarak değil, **deterministik adımlarla (crawl, Lighthouse, build, deploy, bildirim) sarmalanmış ve aralarına Claude Code oturumlarının yerleştirildiği bir *workflow*** olarak kurulmalı; Anthropic'in kendi rehberi de sınırları belli, bölünebilir işler için "predefined code path" yaklaşımını öneriyor ([Anthropic](https://www.anthropic.com/engineering/building-effective-agents)). Pratikte bu, bir TypeScript orkestratörünün (`@anthropic-ai/claude-agent-sdk` ile `query()` ya da `claude -p`) her aşamayı ayrı, bütçesi ve tur sayısı sınırlı bir oturum olarak çalıştırması, aşamalar arasında `runs/<id>/*.json` dosyalarıyla el değiştirmesi ve her "olmazsa olmaz" kuralın (deploy'dan önce build geçsin, testler düzenlenmesin) CLAUDE.md'ye değil **hook'lara** bağlanması demek; çünkü dokümanlar CLAUDE.md'yi "context, not enforced configuration" olarak tanımlıyor ve zorlama için `PreToolUse` hook'unu işaret ediyor ([Claude Code docs](https://code.claude.com/docs/en/memory)). Teknik yığın Ekim 2026 itibarıyla Next.js 16.4 + React 19.3 + Tailwind v4.3 + ESLint flat config + Playwright 1.64 + `@lhci/cli` 0.15.x; Lighthouse CI kategori eşikleri (`categories:performance ≥ 0.9` vb.) tek satırlık `error` assertion'larıyla sert kapı hâline geliyor ([LHCI](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)). Deploy tarafında Vercel'in ücretli iş için **Pro planı şart koştuğunu** ("Receiving payment to create, update, or host the site" ticari kullanım sayılıyor) ve demo sitelerin ilk deploy'unun her zaman production olduğunu bilmek gerekiyor; `noindex` header'ını kendin eklemelisin ([Vercel](https://vercel.com/docs/limits/fair-use-guidelines), [Vercel](https://vercel.com/docs/cli/deploy)). WhatsApp bildirimi için en güvenilir ve ucuz yol Meta Cloud API'de onaylı bir *utility* template (Türkiye tarifesi ≈ $0,0009/mesaj); ilk haftalarda sürtünmesiz bir Telegram botu ile başlayıp WhatsApp'ı sonra eklemek en pragmatik sıra ([Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started), [YCloud](https://www.ycloud.com/blog/whatsapp-api-message-pricing-update-effective-april-1-2026.md)). Site başına LLM maliyeti, benzer açık kaynak klonlayıcıların ölçtüğü $4–9 (Sonnet) / $20–30 (Opus) bandına göre, 5 sayfalık bir KOBİ sitesi için Sonnet 5.5 ağırlıklı bir kurguda **$2–8**, süre 10–30 dakika civarında tahmin ediliyor ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/1528/ai-website-cloner-claude-code-skill-13000-stars-2026)). Hukuki tarafta en kritik üç nokta: demo'nun özel ve `noindex` kalması, kişi fotoğraflarının FSEK 86 / KVKK gereği rızasız kullanılmaması ve KVKK çerez kurallarına uyan bir banner (eşit görünür "Reddet", ön işaretli kutu yok) ([Hukuki Haber](https://www.hukukihaber.net/kisi-fotograf-ve-goruntulerinin-izinsiz-olarak-sosyal-medya-platformlarinda-kullanilmasinin-hukuki-ve-cezai-boyutu), [hukukcularevi.com](https://hukukcularevi.com/cerez-politikasi-ve-cerez-onayi-kvkk/)). Aşağıda mimari, klasör yapısı, her aşamanın araç ve konfigürasyonu, Claude Code skill/subagent/hook tasarımı, kalite kapıları, deploy, bildirim, maliyet, hukuk ve 8 haftalık yol haritası ayrıntılı olarak veriliyor.

## Mimari: ajan değil, kapılı bir workflow ve dosya tabanlı el değiştirme

Bu projenin en önemli tasarım kararı, "tek komut" hissini korurken içeride **altı ayrı, bağımsız yeniden çalıştırılabilir aşama** barındırmak: `crawl → audit → plan → generate → verify → deploy → notify`. Anthropic'in ajan rehberi, çıktısı doğrulanabilir ve adımları önceden bilinen işler için LLM'in kendi akışını yönettiği "agent" yerine "workflow" tasarımını, adımlar arasına programatik "gate"ler koymayı, her adımda ortamdan "ground truth" almayı ve maksimum iterasyon gibi durma koşulları tanımlamayı öneriyor; otonominin bedelini de "higher cost and the risk of compounding errors" olarak koyuyor ([Anthropic](https://www.anthropic.com/engineering/building-effective-agents)). Aynı yönde, LangGraph gibi state-machine kütüphanelerini anlatan 2026 yazısı bile kısa, yeniden denenebilir ve insan onayı gerektirmeyen koşular için "a raw loop is the better default" diyor ([dev.to](https://dev.to/gabrielanhaia/langgraph-in-2026-modeling-an-agent-as-a-state-machine-mbi)). Senin durumunda bu, Inngest/Temporal gibi bir durable-execution motoruna ihtiyaç olmadan, her aşamanın `runs/<run-id>/<stage>/` altına artefakt yazdığı, `state.json`'da `attempt` sayaçları tuttuğu ve çıktısı zaten varsa adımı atladığı (memoization = idempotency) basit bir Node CLI demek. Web arayüzünden tetikleme veya asenkron müşteri onayı gerektiğinde aynı adım fonksiyonlarını Inngest `step.run()` içine sarmak yeterli; Inngest tamamlanan adımları retry'da yeniden çalıştırmıyor ve kendi sunucunda Docker ile barındırılabiliyor ([Inngest](https://www.inngest.com/compare-to-temporal)).

Hangi aşamaların LLM'e, hangilerinin düz koda ait olduğu da net ayrılmalı. Deterministik (LLM'siz) aşamalar: Playwright/Crawlee ile tarama ve ekran görüntüsü, varlık indirme, computed-CSS token çıkarımı, Lighthouse/PSI ölçümü, `tsc`/`next build`, ekran görüntüsü diff'i, olgu (telefon/adres/saat) grep'i, Vercel CLI deploy'u ve bildirim. LLM aşamaları: denetim *anlatısı* (Türkçe, müşteriye dönük), plan (sitemap + bölüm spesifikasyonları), kod üretimi ve sınırlı sayıda düzeltme turu. Bu ayrımın nedeni ölçülebilir: redesign'dan-URL araçlarını inceleyen iki 2026 kaynağı da yalnızca ana sayfanın tarandığını, görsellerin/logonun düşürüldüğünü, iş bilgilerinin (saat, iletişim) kaybolduğunu ve çıktının "generic template patterns"a çöktüğünü rapor ediyor ([Repaint](https://repaint.com/blog/best-ai-website-redesign-tools-2026), [LOW/CODE Agency](https://www.lowcode.agency/blog/ai-website-redesign-from-url)). Olgun açık kaynak klonlayıcılar bunu, içerik ve varlıkları *ground truth* olarak deterministik biçimde çıkarıp, tasarım aşamasını yalnızca yerleşimle sınırlayarak çözüyor: `convert-url-to-nextjs` skill'i varlıkları `public/assets/` altında kaynak URL ve provenance kaydıyla self-host ediyor, dış URL ve `UNVERIFIED` işaretlerini grep ile kapı yapıyor ve bir sayfa tipi **beş turda** geçemezse kullanıcıya eskale ediyor ([llmbase.ai](https://llmbase.ai/skills/yigitkonur/convert-url-to-nextjs/)). 13 bin yıldızlı `ai-website-cloner-template` ise computed CSS'i gerçek tarayıcıdan okuyor, 375/768/1440 px ekran görüntüsü alıyor ve klon ile orijinali perceptual diff ile karşılaştırıp eşik üstü bölgeleri bir fix-agent'a gönderiyor; JS-ağır sitelerde doğruluk %70–85'e düşüyor, statik sayfalarda %95–99 ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/1528/ai-website-cloner-claude-code-skill-13000-stars-2026)). Türk KOBİ sitelerinin büyük kısmı statik WordPress/Wix olduğu için bu senin lehine; Türkiye'de CMS kullanan sitelerin %83,5'i WordPress ve site builder'larda Wix %28,3 ile lider ([Ensonhaber](https://www.ensonhaber.com/icerik-yonetim-sistemi-kullananlarin-yuzde-83u-wordpress-tercih-ediyor-h10888890), [wmtips](https://www.wmtips.com/technologies/website-builders/country/tr/)).

Önerilen monorepo yerleşimi şöyle (Türkçe açıklama, İngilizce isimler):

```
site-rebuild/
├─ orchestrator/                 # Node/TS CLI: `rebuild <url>` tek komutu
│  ├─ src/cli.ts                 # komut ayrıştırma, run-id üretimi
│  ├─ src/stages/{crawl,audit,plan,generate,verify,deploy,notify}.ts
│  ├─ src/claude.ts              # Agent SDK query() sarmalayıcısı (model, bütçe, hooks)
│  ├─ src/state.ts               # runs/<id>/state.json okuma/yazma, attempt sayaçları
│  └─ src/notify/{whatsapp,telegram}.ts
├─ template/                     # Next.js 16.4 şablonu (her müşteri için kopyalanır)
│  ├─ site.config.ts             # tek doğruluk kaynağı: marka, iletişim, saatler, sections[]
│  ├─ src/app/[locale]/{layout,page}.tsx, sitemap.ts, robots.ts, opengraph-image.tsx
│  ├─ src/sections/{hero,services,gallery,testimonials,faq,contact,hours,map,cta-bar}/
│  ├─ src/sections/registry.ts   # Record<SectionType, Component>, discriminated union
│  ├─ src/components/ui/         # shadcn (Base UI) primitifleri
│  ├─ src/lib/{format.ts,schema.ts,seo.ts,jsonld.ts}
│  ├─ src/styles/globals.css     # @theme token'ları = tasarım kuralları
│  ├─ tests/{a11y,visual,smoke}.spec.ts
│  ├─ lighthouserc.cjs  playwright.config.ts  eslint.config.mjs  budget.json
│  ├─ scripts/verify.mjs         # kapıları maliyet sırasıyla koşturur, digest üretir
│  ├─ CLAUDE.md  design-rules.md  build-rules.md  acceptance.json
│  └─ .claude/{skills,agents,rules,settings.json,hooks/}
├─ runs/<run-id>/                # her koşunun artefaktları
│  ├─ state.json
│  ├─ crawl/{pages.json, screenshots/, assets/, asset-manifest.json}
│  ├─ audit/{lighthouse-*.json, issues.json, facts.json, report.tr.md}
│  ├─ plan/{sitemap.json, sections/*.md, design-plan.md}
│  ├─ generate/  (template kopyası + git)
│  ├─ verify/{digest.md, eslint.json, results.json, .lighthouseci/}
│  └─ deploy/{url.txt, project.json}
└─ .pipeline/mcp.json            # Playwright MCP tanımı
```

`site.config.ts` merkezli yapı önemli: LLM yalnızca bu dosyayı, `src/sections/**` ve `globals.css`'i düzenler; `SectionRenderer` `registry[section.type][section.variant]` ile bileşeni seçer, Zod `.strict()` şemalar uydurulmuş alanları derleme/çalışma zamanı hatasına çevirir ve sitemap, robots, metadata, LocalBusiness JSON-LD, `wa.me`/`tel:` linkleri aynı config'ten üretildiği için SEO ve CTA'lar birbirinden sapamaz. Anthropic'in uzun koşan ajan harness yazısı da spesifikasyonu JSON'da tutmayı öneriyor çünkü model JSON'u "less likely to inappropriately change or overwrite" ve "It is unacceptable to remove or edit tests" gibi sert ifadelerin spesifikasyonu koruduğunu belirtiyor ([Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)). Aynı yazı, ajanın uygulamayı nasıl çalıştıracağını çözmeye token harcamaması için bir `init.sh` yazmayı ve gerçek tarayıcı üzerinden test etmenin ("dramatically improved performance") bulamayacağı hataları yakaladığını vurguluyor.

## Aşama aşama araçlar: crawl, audit, plan, generate

**Crawl (deterministik, LLM'siz).** Ana araç Playwright + Crawlee `PlaywrightCrawler`: TypeScript, Apache-2.0, 3.17.0 sürümü Haziran 2026'da çıktı ve `enqueueLinks`, `pushData`, `maxRequestsPerCrawl` ile kuyruk/dataset yönetimini hazır veriyor; tarayıcı yolu bir makinede ~5 s/sayfa ölçüldü, yani 5–30 sayfalık bir KOBİ sitesi dakikalar içinde biter ([Thunderbit](https://thunderbit.com/blog/crawlee-review), [crawlee.dev](https://crawlee.dev/js/docs/examples/playwright-crawler)). İki context aç: masaüstü 1350×940 (Lighthouse'un desktop emülasyonuyla aynı) ve `devices['iPhone 13']` üzerine `locale: 'tr-TR', timezoneId: 'Europe/Istanbul'` ([playwright.dev](https://playwright.dev/docs/emulation)). Her sayfada `page.screenshot({ fullPage: true })` ve `page.evaluate` içinde: `document.fonts` aileleri, CSS custom property'leri, `<img>`/`background-image` URL'leri, `a[href^="tel:"]`, `a[href*="wa.me"], a[href*="api.whatsapp.com"]`, `iframe[src*="google.com/maps"]`, JSON-LD blokları, Türkçe telefon regex'i (`(\+90|0)?\s?5\d{2}…`) ve saat kalıpları (`Pzt|Sal|Çar|Per|Cum|Cmt|Paz`, `09:00 - 18:00`). Logo için `metascraper` + `metascraper-logo` + `metascraper-logo-favicon` (sıra önemli, ilk çözümlenen kural kazanır), renk paleti için `node-vibrant` ([GitHub](https://github.com/microlinkhq/metascraper), [GitHub](https://github.com/Vibrant-Colors/node-vibrant)). Nezaket kuralları: önce `robots.txt`'yi RFC 9309 semantiğiyle parse et (5xx = tam disallow, 4xx = her şey serbest, en uzun eşleşme kazanır), iletişim e-postalı bir User-Agent, `maxConcurrency: 1–2`, same-domain only, form gönderme ve giriş alanlarına girme yok ([RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)). Her varlık için `asset-manifest.json`'a `source_url`, `fetched_at`, `sha256`, `license_unknown` alanları yaz; bu hem hukuki iz hem de generate aşamasının dış URL kullanmasını engelleyen grep kapısının girdisi.

**Audit (deterministik ölçüm + LLM anlatı).** Lighthouse'u `lighthouse` npm modülü ve `chrome-launcher` ile programatik çalıştır; CLI `preset` bayrağı Node'da yok sayıldığı için desktop için config nesnesi geçmen gerekiyor ve Lighthouse 13.0.0 minimum Node'u 22.19'a çekip birçok eski audit'i "insight" denetimleriyle değiştirdi (`image-delivery-insight`, `render-blocking-insight`, `viewport-insight`, `lcp-phases-insight` gibi); eski audit ID'lerine bağlı kod kırılır ([GitHub](https://github.com/GoogleChrome/lighthouse/blob/main/docs/readme.md), [Chrome Developers](https://developer.chrome.com/blog/moving-lighthouse-to-insights)). Mobil ve masaüstü için 3–5 koşu yap, medyan `lhr`'yi JSON olarak sakla. Bağımsız ikinci görüş için PageSpeed Insights v5 REST API ücretsiz (anahtar önerilir); CrUX saha verisi düşük trafikli KOBİ sitelerinde genelde yok, bunu "ölçülemeyecek kadar küçük" bulgusu olarak raporla ([Google](https://developers.google.com/speed/docs/insights/v5/get-started)). Eşikler değişmedi: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 ([web.dev](https://web.dev/articles/vitals)). Erişilebilirlik için `@axe-core/playwright` ile `withTags(['wcag2a','wcag2aa','wcag21aa'])` ([npm](https://www.npmjs.com/package/@axe-core/playwright)). Lighthouse skorlarını satış argümanı yaparken dürüst ol: aynı site iki MacBook Air'de 30 puan fark verebiliyor, PSI simüle throttling kullanıyor ve dört lokasyondan çalışıyor; aracı, sürümü, cihaz profilini belirt ve ≥3 koşunun medyanını raporla ([Zach Leatherman](https://frontendfoc.us/link/115127/web), [DebugBear](https://www.debugbear.com/blog/why-is-my-lighthouse-score-different-from-pagespeed-insights)).

Denetim çıktısı makine-okunur bir `issues.json` olmalı; önerilen şema `{id, category, severity, title, title_tr, evidence[], affected_urls, fix, effort, business_impact, source_tool, confidence}` ve kategoriler `performance | seo_technical | seo_local | accessibility | ux_design | content_conversion | legal_tr | security`. `title_tr` alanı aynı JSON'dan Türkçe müşteri raporu ve İngilizce mühendislik backlog'u üretmeni sağlar. Yerel SEO denetiminde Google'ın LocalBusiness şeması `name` ve `address` zorunlu, `geo`, `telephone` (ülke koduyla), `openingHoursSpecification`, `priceRange` önerilir ve en spesifik alt tip (`Dentist`, `HairSalon`) kullanılmalı ([Google](https://developers.google.com/search/docs/appearance/structured-data/local-business)). NAP (ad-adres-telefon) tutarlılığını footer, iletişim sayfası, şema ve Google Business Profile arasında karşılaştır; NAP'ın yalnızca görsel içinde değil düz metin olarak bulunması gerekiyor ([lseo.com](https://lseo.com/blog/uncategorized/nap-consistency-why-it-matters-for-local-seo-rankings-in-2026/)). Severity'yi kanaate değil ölçüme bağla: `critical` = hukuki risk (analitik çalışırken çerez onayı yok, HTTPS yok) veya dönüşüm engeli (mobilde tel/WhatsApp yok); `high` = CWV "poor" bandı, axe critical/serious, LocalBusiness yok, NAP uyuşmazlığı.

Tasarım/UX kritiği için LLM-vision kullanırken araştırma net uyarıyor: jenerik "critique this UI" promptları insan tasarımcıların altında kalıyor; rubrik, few-shot örnek ve her bulguya bounding box eklenen iteratif rafine etme insanlara olan farkı %50 kapatıyor ve UICrit veri setiyle few-shot %55 kazanım sağlıyor ([arXiv 2412.16829](https://arxiv.org/abs/2412.16829v1), [arXiv 2407.08850](https://arxiv.org/abs/2407.08850)). Çok-modlu yargıçlar insanlarla Pearson 0,69–0,73 korelasyon gösteriyor; netlik, görsel hiyerarşi ve güvenilirlik gibi somut faktörlerde güvenilir, "estetik haz" ve "ilginçlik"te sistematik olarak yanılıyor ([arXiv 2510.08783](https://arxiv.org/html/2510.08783v1)). Bu yüzden audit'teki `ux_design` bulgularını ikili ve gözlemlenebilir sorulara indir ("ilk mobil ekranda işletmenin ne yaptığı, nerede olduğu ve nasıl ulaşılacağı görünüyor mu?", "telefon numarası görsel mi metin mi?"), DOM'dan çıkarılmış olguları (font boyutları, kontrast, tel linki var/yok) prompta ekle ki model tahmin etmek yerine eleştirsin, ve ikinci bir geçişte her bulguyu `verified: true/false` ile ekran görüntüsüne karşı doğrulat.

**Plan ve generate (LLM).** Plan aşaması `sitemap.json` ve her bölüm için bir markdown spesifikasyonu üretir; generate aşaması ise şablonu kopyalayıp `site.config.ts` ve `sections/`'ı doldurur. Anthropic'in frontend-design skill'i jenerik "AI görünümü"nü somut kalıplarla tarif ediyor: krem arka plan + serif + terracotta vurgu; siyah zemin + tek asit-yeşil vurgu; her şeyin aynı radius ve aynı gri gölgeyle kartlandığı "SaaS-card kit"; her başlığın üstünde tracked-out ALL-CAPS etiket; buton metnine eklenen "→"; her bölümde fade-up animasyon ([skills.sh](https://skills.sh/anthropics/claude-code/frontend-design)). Aynı skill'in süreci ikili: önce 4–6 hex renk, 1–2 yazı tipi ve ASCII wireframe içeren kısa bir tasarım planı yaz, sonra bu planı "would produce for any similar page" testinden geçirip jenerik kısımları değiştir; "spend your boldness in one place". Bunu `design-plan.md` adında zorunlu bir artefakt yap ve generate skill'ine "önce planı yaz, beş jenerik kümeden hangisine benziyorsa onu değiştir, sonra kodla" dedirt.

Tasarım kurallarını düzyazı yerine **çalıştırılabilir** hâle getir. Tailwind v4'te token'lar `@theme` içinde CSS değişkeni (`--color-*`, `--font-*`, `--text-*`, `--spacing-*`, `--radius-*`) ve renkler `oklch()` ile belgeleniyor; tek bir `--brand-h`/`--brand-c` çiftinden OKLCH rampası türetirsen LLM yalnızca iki sayıya dokunur ve tüm utility'ler takip eder ([Tailwind](https://tailwindcss.com/docs/theme)). Türkçe doğruluğu da kod olmalı: Node 22'de `Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'})` `₺1.234,56`, `Intl.DateTimeFormat('tr-TR',{dateStyle:'long'})` `17 Ekim 2026` üretiyor; `'istanbul'.toLocaleUpperCase('tr-TR')` `İSTANBUL` verirken düz `.toUpperCase()` `ISTANBUL` döndürüyor ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)). Bu yüzden `src/lib/format.ts` içinde `formatTRY`, `formatDateTR`, `upperTR`, `toE164TR`, `telHref`, `waHref` yardımcıları ve ESLint'te `.toUpperCase()`/`.toLowerCase()` çağrılarını yasaklayan `no-restricted-syntax` kuralı olmalı. WhatsApp linki `https://wa.me/905XXXXXXXXX` biçiminde, `+`/boşluk/tire olmadan ve `?text=` ile URL-encode önceden doldurulmuş metin ([Wati](https://support.wati.io/en/articles/11462980-how-to-create-whatsapp-click-to-chat-links)). Fontlar `next/font/google` ile self-host edilir (Google'a istek gitmez), `subsets: ['latin','latin-ext']` ş/ğ/ı/İ/ç/ö/ü için gerekli, `adjustFontFallback` CLS'i düşürür ([Next.js](https://nextjs.org/docs/app/api-reference/components/font)).

Şablon sürümleri: Next.js 16.4 (6 Ekim 2026) `create-next-app`'te Cache Components'ı varsayılan yaptı, `next lint`'i kaldırdı (ESLint CLI şart) ve pazarlama sayfaları için "Next.js will fail the build if any dynamic content is ever included" diyen `export const ensureStatic = 'navigation'`'ı ekledi; bu, kazara dinamik render'ı bedava bir build kapısına çeviriyor ([Next.js](https://nextjs.org/blog/next-16-4), [Next.js](https://nextjs.org/docs/app/api-reference/config/eslint)). shadcn Temmuz 2026'dan beri Base UI'ı varsayılan kullanıyor ve Eylül'de `cn` paketi `clsx`+`tailwind-merge`'ü değiştirdi ([shadcn](https://ui.shadcn.com/docs/changelog)). Metadata API'de `metadataBase`, `title.template`, `alternates.languages: {'tr-TR': '/', 'x-default': '/'}` ve `openGraph.locale: 'tr_TR'` (OG için alt çizgi) kullan; iç içe segmentlerde metadata shallow-merge olduğu için `openGraph` nesnesi tamamen değişir ([Next.js](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)).

## Claude Code tasarımı: skill, subagent, hook ve headless koşu

**Skill'ler (giriş noktaları).** Ekim 2026'da custom command'lar skill'lere birleşti: `.claude/commands/x.md` çalışıyor ama `.claude/skills/x/SKILL.md` önerilen biçim ve `-p` modunda prompt dizgesine `/skill-name` yazınca açılıyor ([Claude Code docs](https://code.claude.com/docs/en/skills), [Claude Code docs](https://code.claude.com/docs/en/headless)). Her aşamayı `disable-model-invocation: true` (modelin kendi başına tetiklemesi yasak, yalnız sen/orkestratör), dar bir `allowed-tools` listesi ve `argument-hint` ile tanımla. Örnek:

```yaml
---
name: generate
description: Fill the Next.js template from runs/<id>/plan using design-rules.md
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Bash(pnpm run *), Bash(git commit *)
argument-hint: [run-id]
effort: high
---
Read runs/$ARGUMENTS/plan/sitemap.json, runs/$ARGUMENTS/audit/facts.json and design-rules.md.
1. Write runs/$ARGUMENTS/plan/design-plan.md first (palette, type, ASCII wireframes, the one bold element).
2. Check the plan against the five generic clusters in design-rules.md; change what matches.
3. Edit ONLY site.config.ts, src/sections/**, src/styles/globals.css, public/images/**.
4. Facts in facts.json are verbatim; never invent hours, prices, phone numbers.
5. Run `pnpm run verify`; read .reports/digest.md; fix; commit. Stop after 3 failed rounds and write BLOCKED.md.
```

`!`cmd`` söz dizimiyle skill çalışmadan önce kabuk çıktısını (ör. `cat runs/$0/verify/digest.md || true`) prompta gömebilirsin; başarısız komut çağrıyı iptal ettiği için `|| true` ekle ve komutu `allowed-tools`'ta ön onayla ([Claude Code docs](https://code.claude.com/docs/en/skills)).

**Subagent'lar (bağlam izolasyonu ve maliyet).** `.claude/agents/*.md` dosyaları `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `isolation: worktree`, `effort` alanlarını destekliyor; subagent'lar taze bağlamla başlar (ana sohbeti görmez), varsayılan iç içe derinlik 3 ve eşzamanlılık 20 ([Claude Code docs](https://code.claude.com/docs/en/subagents)). Önerilen set: `visual-auditor` (`model: sonnet`, `tools: Read, mcp__playwright__*`, ekran görüntülerini okuyup `ux_design` bulgularını JSON yazar), `section-builder` (`model: sonnet`, `isolation: worktree`, tek bölüm bileşenini üretir; klonlayıcı şablonun bileşen başına worktree deseni), `design-judge` (`model: opus` veya ayrı bir context, ikili rubrik ile `pass/fail` döner) ve `fix-agent` (`maxTurns: 25`, yalnız `digest.md`'yi okuyup düzeltir). Kritik bir detay: arka plan subagent'ları "get a smaller built-in tool set… Most built-in tools are removed, but MCP tools are kept", dolayısıyla Playwright MCP'ye dayanan `visual-auditor` arka planda çalışabilir ama `Bash`/`Write` isteyen üreticiler ön planda kalmalı ([Claude Code docs](https://code.claude.com/docs/en/subagents)). Ana sohbet `bypassPermissions`/`acceptEdits`/`auto` modundaysa subagent kendi `permissionMode`'unu yok sayıp onu devralır; bu da orkestratör düzeyinde `dontAsk` + açık allowlist'in neden daha güvenli olduğunu açıklıyor.

**Hook'lar (zorlama katmanı).** Hook'lar `settings.json`'da event → matcher → handler yapısında; `PreToolUse` exit code 2 veya `permissionDecision: "deny"` ile aracı engelleyebilir, `Stop` hook'u `decision: "block"` ile turun bitmesini engelleyip Claude'u çalışmaya devam ettirir ve dokümanlar bunu "what let an unattended run finish correctly without you" diye tanımlar ([Claude Code docs](https://code.claude.com/docs/en/hooks), [Claude Code docs](https://code.claude.com/docs/en/best-practices)). İzin değerlendirme sırası hooks → deny → ask → mode → allow olduğu için "a hook deny applies even in `bypassPermissions` mode" ([Claude Code docs](https://code.claude.com/docs/en/agent-sdk/permissions)). Dört hook öneriyorum:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "if": "Bash(vercel *)", "onFailure": "block",
          "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/deploy-gate.sh" } ] },
      { "matcher": "Edit|Write", "hooks": [
        { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-tests.sh" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [
        { "type": "command", "command": "npx prettier --write \"$(jq -r .tool_input.file_path)\" >/dev/null 2>&1 || true" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/stop-gate.sh", "timeout": 600 } ] }
    ]
  }
}
```

`deploy-gate.sh`, `.pipeline/verify-passed` işaretini (verify aşaması yazar) kontrol eder; yoksa `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"verify has not passed"}}` basar. `onFailure: "block"` (v2.1.295+) hook script'i bulunamazsa veya zaman aşımına uğrarsa da engeller; dokümanın ifadesiyle "a mistyped path otherwise lets everything through" ([Claude Code docs](https://code.claude.com/docs/en/hooks)). `protect-tests.sh`, `tests/**`, `lighthouserc.cjs`, `budget.json`, `playwright.config.ts`, `acceptance.json` yollarına yazımı reddeder. `stop-gate.sh` ise `tsc --noEmit && next build` koşturur, başarısızsa ilk 50 satır hatayı `reason` olarak döner; ancak Claude Code bir Stop hook'unu arada araç çağrısı olmadan art arda 8 kez engellerse geçersiz kılar, bu yüzden script `stop_hook_active` alanını okuyup `true` ise erken çıkmalı ([Claude Code docs](https://code.claude.com/docs/en/hooks-guide)). `PostToolUse` + `updatedToolOutput` veya `PreToolUse` + `updatedInput` ile gürültülü build/test çıktısını `grep -A 5 -E '(FAIL|ERROR|error:)' | head -100` gibi kırpmak bağlam maliyetini düşürür; bu desen resmi maliyet dokümanında örnekleniyor ([Claude Code docs](https://code.claude.com/docs/en/costs)).

**CLAUDE.md ve rules.** 200 satırın altında tut, her satır için "kaldırırsam Claude hata yapar mı?" sorusunu sor, çelişen talimatlarda "Claude may pick one arbitrarily" ([Claude Code docs](https://code.claude.com/docs/en/memory), [Claude Code docs](https://code.claude.com/docs/en/best-practices)). İçerik: stack pinleri, tam komutlar (`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`, `pnpm verify`), düzenlenebilir dosya listesi, "facts.json verbatim", sert yasaklar (`<img>`, keyfi hex, ikiden fazla display/body font ailesi + opsiyonel mono aksan, ALL-CAPS etiket, buton sonuna `→`, bölüm başına scroll-reveal, display yüzü olarak Inter/Roboto — Inter yalnızca sitenin yönü onu listeliyorsa gövde yüzü olarak kullanılabilir, asla varsayılan olarak değil; bkz. docs/DECISIONS.md D10 §11 C4) ve compaction talimatı ("preserve the full list of modified files and the verify command"). Yol-özel kuralları `.claude/rules/components.md` (`paths: ["src/sections/**/*.tsx"]`) ve `.claude/rules/app.md` (`paths: ["src/app/**"]`) dosyalarına taşı; bunlar yalnızca eşleşen dosya okunduğunda yüklenir ([Claude Code docs](https://code.claude.com/docs/en/memory)).

**Headless koşu ve izinler.** Orkestratör her aşamayı ya `claude -p` ile ya da Agent SDK `query()` ile çalıştırır. CLI tarafında güvenli reçete: `--permission-mode dontAsk` (prompt üretecek her şey reddedilir, "Locked-down CI and scripts"), `--permission-prompts none`, dar `--allowedTools`, `--max-turns`, `--max-budget-usd`, `--output-format json --json-schema '…'` ve `--mcp-config ./.pipeline/mcp.json --strict-mcp-config` ([Claude Code docs](https://code.claude.com/docs/en/permission-modes), [Claude Code docs](https://code.claude.com/docs/en/headless)). `--allowedTools "Bash(pnpm run *)"` yazarken `*` öncesi boşluk kritik; `Bash(git diff*)` `git diff-index`'i de eşler. `--dangerously-skip-permissions`'ı yalnız atılabilir konteynerde kullan; auto-mode sınıflandırıcısı bu deseni açıkça işaretliyor ve bypass allowlist'leri yok sayıyor. `--bare` script'ler için önerilen mod ve `-p` için gelecekte varsayılan olacak, ama hook'ları, skill'leri ve CLAUDE.md'yi de atlıyor; bu projede ya `--bare` kullanmayıp kendi kontrolündeki repoda çalış ya da kuralları `--append-system-prompt-file` ve `--settings` ile geç ([Claude Code docs](https://code.claude.com/docs/en/headless)). Playwright MCP tanımı `.pipeline/mcp.json`'da `npx -y @playwright/mcp@latest --headless --isolated --viewport-size 1440x900 --output-dir runs/<id>/crawl/screens`; `browser_snapshot` (erişilebilirlik ağacı, metin, ucuz) yapı/içerik için, `browser_take_screenshot` yalnız kontrol noktalarında ([GitHub](https://github.com/microsoft/playwright-mcp)). Claude in Chrome CI'da çalışmaz: görünür Chrome ve claude.ai aboneliği ister, API anahtarıyla kapalı ([Claude Code docs](https://code.claude.com/docs/en/chrome)). Claude'un `Read` aracı PNG/JPG'yi görsel içerik olarak döndürür (büyükse yeniden boyutlandırıp 500 KB üstünü JPEG'e çevirir), yani eski/yeni ekran görüntüsü karşılaştırması mümkün ([Claude Code docs](https://code.claude.com/docs/en/tools-reference)).

TypeScript orkestratör için Agent SDK daha doğal: `query({ prompt, options })` her aşamada ayrı `model`, `maxTurns`, `maxBudgetUsd`, `agents`, `hooks` (deploy kapısı in-process `PreToolUse` callback olarak) ve bir sonraki aşamanın tüketeceği `outputFormat: { type: 'json_schema' }` alır; `env` seçeneği alt süreç ortamını **değiştirir** (`...process.env` yaymalısın) ve bu, `VERCEL_TOKEN`'ı yalnız deploy aşamasının görmesini sağlamanın temiz yolu ([Claude Code docs](https://code.claude.com/docs/en/agent-sdk/typescript)). Daha da iyisi: Vercel deploy ve bildirimi `tool()` + `createSdkMcpServer()` ile in-process araç yapıp `mcp__pipeline__deploy_vercel` olarak allowlist'e al; token Node sürecinde kalır, modelin Bash ortamına hiç girmez. Bütçe aşımında `result.subtype === 'error_max_budget_usd'` döner ve çalışan arka plan subagent'ları durdurulur; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "1"`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: "5"` ile büyümeyi sınırla ([Claude Code docs](https://code.claude.com/docs/en/agent-sdk/subagents)). Üçüncü taraflara satılan bir üründe API anahtarı zorunlu; "Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products" ([Claude Code docs](https://code.claude.com/docs/en/agent-sdk/overview)).

## Kalite kapıları ve üç turlu düzeltme döngüsü

`scripts/verify.mjs` kapıları **maliyet sırasıyla** koşturur ve ilk başarısız aşamada durur: `tsc --noEmit` → `eslint . --format json` → `next build` (içinde `ensureStatic`) → Playwright (smoke + axe + görsel) → `lhci autorun` → lychee link kontrolü. ESLint flat config Next 16 için `defineConfig([...nextVitals, ...nextTs, jsxA11y.flatConfigs.strict, prettier, {rules}, globalIgnores([...])])`; `core-web-vitals` paketi `@next/next/no-img-element` gibi kuralları hataya yükseltir ([Next.js](https://nextjs.org/docs/app/api-reference/config/eslint)). Playwright tarafında `expect(page).toHaveScreenshot()` için `maxDiffPixelRatio`, `threshold`, `animations: 'disabled'` ve 1.64'teki `--update-snapshots=missing` eksik baseline'ı oluşturup mevcutları doğrular; baseline'lar aynı ortamda üretilmeli ve fare `(-1,-1)`'e taşınmalı ([Playwright](https://playwright.dev/docs/test-snapshots), [Playwright](https://playwright.dev/docs/release-notes)). Görsel baseline müşteri başına **bir kez** üretilir ve yalnız o müşterinin düzeltme turlarında regresyon için kullanılır; müşteriler arası karşılaştırma anlamsız. Smoke testi `html[lang^="tr"]`, tek `h1`, başlık varlığı ve tüm `tel:`/`wa.me` href'lerinin `^(tel:\+90\d{10}|https:\/\/wa\.me\/90\d{10})` desenine uymasını kontrol eder; axe `withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice'])` ile (`wcag22a` etiketi yok) `violations` boş olmalı ([Playwright](https://playwright.dev/docs/accessibility-testing), [GitHub](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md)).

Lighthouse CI yapılandırması bu raporun hazır kullanılabilir çekirdeği:

```js
// lighthouserc.cjs
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start -- -p 3000',
      startServerReadyPattern: 'Ready|ready|listening',
      startServerReadyTimeout: 30000,
      url: ['http://localhost:3000/', 'http://localhost:3000/hizmetler', 'http://localhost:3000/iletisim'],
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --disable-gpu' },
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        'categories:performance':    ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:accessibility':  ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo':            ['error', { minScore: 0.95 }],
        'largest-contentful-paint':  ['error', { maxNumericValue: 2500, aggregationMethod: 'median-run' }],
        'cumulative-layout-shift':   ['error', { maxNumericValue: 0.1 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 250000 }],  // bytes
        'resource-summary:font:count':  ['warn',  { maxNumericValue: 2 }],
        'unused-javascript': 'warn',
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
```

Assertion'lar `off|warn|error` seviyeleri alır, `error` çalışmayı sıfır olmayan çıkış koduyla bitirir, `aggregationMethod: 'median-run'` performans dalgalanmasını azaltır; inline bütçeler **byte**, `budget.json` ise **KB** cinsinden ([LHCI](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)). `upload.target: 'filesystem'` `manifest.json` ve LHR JSON yazar; ajan `audits[*].score` ve `details.items`'ı parse edip digest üretir. `temporary-public-storage` herkese açık ve geçici, müşteri demolarında kullanma. LHCI'ın son sürümü 0.15.1 (Haziran 2025) ve Lighthouse 12.6.1'e dayanıyor; Lighthouse 13 ile uyumunu başlangıçta test et, gerekirse doğrudan `lighthouse` npm paketi + küçük bir Node assertion script'i kullan ([GitHub](https://github.com/GoogleChrome/lighthouse-ci/releases)).

Düzeltme döngüsü şöyle: `verify.mjs` başarısızlıkları ≤2–4k token'lık bir `digest.md`'ye normalize eder (tsc/eslint için `file:line` + mesaj, kural bazında tekilleştirilmiş; axe için `id`, `impact`, `help`, ilk 3 `nodes[].target`; LHCI için başarısız audit id, beklenen/gerçek, URL; görsel için diff yolu ve piksel oranı). Orkestratör `fix-agent`'ı digest + "yalnız `site.config.ts`, `src/sections/**`, `globals.css` düzenleyebilirsin; test ve konfig dosyalarına dokunma" talimatıyla çağırır. **Maksimum 3 iterasyon**; her başarılı tur `git commit -m "fix: gate <stage>"`, başarısızsa `git checkout .` ve `BLOCKED.md` ile insana eskalasyon. Üç sayısı için ölçülmüş bir optimum bulunamadı, uygulayıcı konvansiyonu; `convert-url-to-nextjs` beş turda eskale ediyor ([llmbase.ai](https://llmbase.ai/skills/yigitkonur/convert-url-to-nextjs/)). `warn` seviyesindeki LHCI çıktısını digest'te "öneri" olarak işaretle ki ajan gürültünün peşine düşmesin. `acceptance.json`'daki kabul listesini ajan yalnız `passes: true`'ya çevirebilir; başka alan değiştiremez ([Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).

Tasarım kalitesi için ayrı bir `design-judge` geçişi ekle ama onu doğru kullan. Rubrik metninin kendisi yargıcı yönlendiriyor: yalnızca rubrik metnine bakan bir sınıflandırıcı LLM yargıç etiketlerini ~0,8 doğrulukla tahmin edebiliyor ve "fail/not/should" gibi olumsuz sözcükler fail etiketlerini artırıyor; yanıt tersine çevrildiğinde yargıç yalnızca %37,7 oranında kararını değiştiriyor ([arXiv 2609.02942](https://arxiv.org/pdf/2609.02942)). Bu yüzden rubrik soruları nötr, ikili ve görsel olarak doğrulanabilir olmalı: "İlk mobil ekranda tam olarak bir birincil CTA görünüyor mu?", "Herhangi bir bölüm ALL-CAPS eyebrow etiketi kullanıyor mu?", "Üç veya daha fazla bölüm aynı gölgeli, aynı radius'lu kart grid'i olarak mı yerleşmiş?", "Türkçe metinde s/ş, g/ğ, i/ı ASCII ikamesi var mı?". Her soru için `{id, pass, evidence}` JSON'u iste. Estetik için mutlak 1–10 puan yerine aynı brief'ten üretilen iki varyantı **ikili karşılaştır**, A/B sırasını rastgeleleştir, 3 kez örnekle ve yalnız oy birliğinde güven; UI-judge çalışması ikili anlaşmanın insan puan farkı büyüdükçe arttığını gösteriyor ([arXiv 2510.08783](https://arxiv.org/html/2510.08783v1)). Jenerik-işaret veya Türkçe-metin kontrollerinde başarısızlık sert fail, kalanı "tasarım notu" olarak digest'e gider.

## Vercel deploy, önizleme koruması ve WhatsApp bildirimi

**Deploy.** Token-only headless akış: `VERCEL_TOKEN` ortam değişkeni (`--token` process listesine sızar), ardından `vercel link --yes --project <client-slug> --scope <team-slug>` ve `URL=$(vercel deploy --prod --yes --scope <team-slug>)`; `vercel deploy`'un stdout'u her zaman deployment URL'si, hatalar stderr'e gider, çıkış kodu 0/1/2 ([Vercel](https://vercel.com/docs/cli/global-options), [Vercel](https://vercel.com/docs/cli/deploy)). CLI 55 (15 Temmuz 2026) kırıcı bir değişiklik getirdi: `--yes` artık takım seçmiyor; birden fazla takımın varsa `--scope`/`--team`/`VERCEL_ORG_ID` vermeden headless komut `missing_scope` ile düşer ([Vercel](https://vercel.com/changelog/faster-predictable-project-linking-in-the-vercel-cli)). 50+ site için en deterministik yol REST: `POST /v11/projects?slug=<team>` ile `{ name, framework: "nextjs" }` gövdesiyle projeyi yarat (`projectId` döner), `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`'yi birlikte export et (yalnız biri hata verir) ve `vercel deploy` çalıştır ([Vercel](https://vercel.com/docs/rest-api/reference/endpoints/projects/create-a-new-project)). Vercel Labs'ın kendi ajan skill'i de aynı pitfall'ları listeliyor: linklenmemiş dizinde `vercel link`/`project inspect` çalıştırma (sessizce yanlış projeye bağlanabilir), `vercel ls`/`whoami` güvenli ([tessl.io](https://tessl.io/registry/skills/github/vercel-labs/agent-skills/vercel-cli-with-tokens)). Her müşteri build'ini geçici bir checkout'ta yap ki `.vercel/` artefaktları müşteriler arası sızmasın; proje adı aynı zamanda `<slug>.vercel.app` URL'si olduğu için slug'lar takım içinde benzersiz ve URL-güvenli olmalı. Deneysel doğrulama gerekiyor: `vercel link --yes --project NAME` projenin yoksa yaratıp yaratmadığını resmi dokümanlar açıkça söylemiyor; changelog "project creation across the team" ifadesini kullanıyor ama REST yolu kesin ([Vercel](https://vercel.com/changelog/faster-predictable-project-linking-in-the-vercel-cli)).

**Plan ve maliyet.** Hobby "non-commercial personal use only"; ticari kullanım tanımı "any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production" ve örneklerinde "Receiving payment to create, update, or host the site" açıkça geçiyor ([Vercel](https://vercel.com/docs/limits/fair-use-guidelines)). Satış amaçlı demo bile olsa Pro şart: $20/ay platform ücreti, 1 koltuk, $20 kullanım kredisi, sınırsız proje, 6000 deploy/gün, Flat Rate CDN'de 1 TB ([Vercel](https://vercel.com/docs/plans/pro-plan), [Vercel](https://vercel.com/docs/limits)). Hobby'de ayrıca 200 proje, 100 deploy/gün, 1 eşzamanlı build ve GitHub org repolarına bağlanamama sınırları var. Satıştan sonra projeyi müşteriye devretmek "Transfer Project" ile sıfır kesintiyle mümkün (env, domain, git bağlantısı taşınır; entegrasyonlar taşınmaz), ama hedef takımda üye olman gerekiyor ([Vercel](https://vercel.com/docs/projects/transferring-projects)).

**Önizleme koruması ve noindex.** İki gerçek kuralı belirliyor: (1) "The first deployment of a new project is always a production deployment", yani demo URL'si production sayılır ([Vercel](https://vercel.com/docs/cli/deploy)); (2) Vercel `X-Robots-Tag: noindex`'i yalnız *preview* deployment'lara otomatik ekler, production'a ve custom domain atanmış non-production branch'lere eklemez ([Vercel](https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines)). Dolayısıyla `noindex`'i kendin ekle: `next.config.ts`'te `SITE_PREVIEW=1` ortam değişkeni varsa `headers()` ile `X-Robots-Tag: noindex, nofollow`, `app/robots.ts`'te `disallow: '/'`, metadata'da `robots: { index: false }`, satış sonrası `SITE_PREVIEW`'i kaldır. Erişim kontrolü için Vercel Authentication tüm planlarda ücretsiz ve yeni projelerde varsayılan açık, ama ziyaretçiyi Vercel girişine yönlendirir; Vercel hesabı olmayan müşteri için **Password Protection Pro'da $20/ay/proje** (20 Eylül 2026'da $150/ay takım eklentisinin yerini aldı) ve Hobby'de yok ([Vercel](https://vercel.com/docs/deployment-protection/usage-and-pricing), [usagepricing.com](https://www.usagepricing.com/blueprint/activity/vercel-2026-09-20-password-protection-replaces-150-addon)). 50 demo için $1.000/ay anlamsız; bunun yerine `proxy.ts` (Next 16'da middleware'in yeni adı) içinde `SITE_PREVIEW=1` iken basit Basic-Auth ve sayfada görünür "Taslak / Önizleme — resmi site değildir" bandı. Shareable Links tüm planlarda var ama Hobby'de hesap başına toplam bir link ([Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links)). CI'dan korumalı deployment'ı test etmek için `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET` + `x-vercel-set-bypass-cookie: true` header'ları Playwright `extraHTTPHeaders`'a eklenir ([Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)).

**WhatsApp bildirimi: seçenekler ve öneri.** Beş yol kıyaslandı:

| Seçenek | Kurulum | Maliyet (Eki 2026) | Güvenilirlik | Risk |
|---|---|---|---|---|
| Meta Cloud API, onaylı utility template | Orta-yüksek (Meta dev hesabı, business portfolio, system-user token, template onayı) | Test numarasında ücretsiz; gerçek numarada Türkiye ≈ $0,0009/mesaj | Yüksek (resmi, 24 saat penceresinden bağımsız) | Düşük |
| Meta Cloud API, serbest metin | Aynı + her 24 saatte bota önce sen yazmalısın | 1.000 servis mesajı/ay ücretsiz (1 Ekim 2026 sonrası, BSP'lerin bildirdiği) | Yüksek | Pencere kapanırsa cron kırılır |
| Twilio Sandbox | Düşük-orta, 3 günde bir `join` | $0,005 + Meta ücreti | Orta, prod için değil | Düşük |
| CallMeBot | Çok düşük | Ücretsiz | Düşük-orta ("bot full", numara değişir) | Yalnız kişisel kullanım, üçüncü taraf mesajı görür |
| whatsapp-web.js / Baileys | Orta | Ücretsiz | Düşük | Yüksek: ToS ihlali, kalıcı ban riski |
| Telegram Bot API | Çok düşük | Ücretsiz | Yüksek | Yok |

Meta'nın resmi akışı: Meta app + WhatsApp Business Account, test numarası ile ≤5 kayıtlı alıcıya mesaj, kalıcı token için System User'a `whatsapp_business_messaging` izni, `POST https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>/messages` ([Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)). Türkiye utility tarifesi 1 Nisan 2026'da $0,0053'ten $0,0009'a düştü ([YCloud](https://www.ycloud.com/blog/whatsapp-api-message-pricing-update-effective-april-1-2026.md)). 1 Ekim 2026'dan itibaren servis mesajlarının numara başına 1.000/ay üstünde ücretli olması respond.io ve Zoho tarafından bildiriliyor ama Meta'nın kendi fiyat sayfasında 17 Ekim itibarıyla henüz görünmüyor; dolayısıyla "BSP'ler bildiriyor, Meta sayfasında yok" diye not et ([respond.io](https://respond.io/blog/whatsapp-pricing-change-2026), [Meta](https://developers.facebook.com/docs/whatsapp/pricing)). whatsapp-web.js ve Baileys ToS'u ihlal ediyor ve "Permanent bans on associated phone numbers" riski taşıyor; kişisel numaranı asla buna bağlama ([Zylos](https://zylos.ai/research/2026-01-26-whatsapp-api-automation)).

**Önerim:** Hafta 1'de Telegram botu (BotFather, `getUpdates` ile `chat.id`, `sendMessage`; ücretsiz, pencere yok) ile başla, böylece boru hattının kalanını bildirim sürtünmesi olmadan kurarsın ([Telegram](https://core.telegram.org/bots/api), [Telegram](https://core.telegram.org/bots/faq)). Hafta 3–4'te Meta Cloud API'de `site_ready` adlı Türkçe bir **utility template** onaylat ("{{1}} için yeni site hazır. Eski: {{2}} Yeni: {{3}} Gir bak.") ve kendi numaranı alıcı olarak kaydet; template mesajı 24 saat penceresine bağlı olmadığından gözetimsiz cron'da çalışır. `notify` aşaması `whatsapp` başarısız olursa `telegram`'a düşer (fallback). Bildirimi modele bırakma: SDK'da in-process `tool()` olarak ya da orkestratörün `deploy` sonrasında doğrudan çağırdığı bir fonksiyon olarak uygula; isteğe bağlı olarak `SessionEnd`/`PostToolUse` `type: "http"` hook'u da aynı webhook'u tetikleyebilir ([Claude Code docs](https://code.claude.com/docs/en/hooks)).

```ts
// orchestrator/src/notify/whatsapp.ts
export async function notifySiteReady(clientName: string, oldUrl: string, newUrl: string) {
  const res = await fetch(`https://graph.facebook.com/v25.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: process.env.OPERATOR_WHATSAPP,           // "+905xxxxxxxxx"
      type: "template",
      template: {
        name: "site_ready", language: { code: "tr" },
        components: [{ type: "body", parameters: [
          { type: "text", text: clientName }, { type: "text", text: oldUrl }, { type: "text", text: newUrl } ] }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
}
```

## Maliyet, süre, hukuk ve Türkiye'ye özgü kurallar

**LLM maliyeti ve süre.** Liste fiyatları (Ekim 2026): Sonnet 5.5 $2 giriş / $10 çıkış per milyon token (cache hit $0,10), Opus 5.5 $4 / $20, Haiku 5.5 $0,10 / $0,50; Batch API %50 indirimli ([Claude platform](https://platform.claude.com/docs/en/about-claude/pricing)). Tek ölçülmüş saha verisi, piksel-sadık çoklu-ajan klonu için site başına $4–9 (Sonnet 4.6) ve $20–30 (Opus 4.7) ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/1528/ai-website-cloner-claude-code-skill-13000-stars-2026)). Buradan türetilen tahmin: ~5 sayfa okuyan (150–300K giriş token'ı, büyük kısmı cache'lenebilir), 30–60K çıkış token'ı yazan ve 2–4 düzeltme turu geçiren bir redesign **Sonnet 5.5'te $2–8, Opus 5.5'te $5–20**; Haiku 5.5 çıkarım ve özetleri alırsa $1'ın altında kalır. Duvar saati 10–30 dakika, crawl + build + ekran görüntüsü döngüleri baskın. Bunlar çıkarım, ölçüm değil. Model planı: `haiku` crawl/çıkarım subagent'ları, `sonnet` audit ve üretim, `opus` (veya en zor muhakeme için `fable`) yalnız plan/mimari adımı; mekanik aşamalarda `effort: low|medium`. Her aşamayı taze oturum olarak çalıştır: uzun oturumlar her istekte tüm konuşmayı yeniden gönderir ve boşta kalınca cache miss alır ([Claude Code docs](https://code.claude.com/docs/en/costs)). Gözetimsiz hat için abonelik yerine API anahtarı (Console'da "Claude Code" workspace'i, harcama limitleri): abonelik kullanımı 5 saatlik ve haftalık pencerelere bağlı, Claude sohbetiyle paylaşımlı ve dolar cinsinden değil ([Claude Code docs](https://code.claude.com/docs/en/costs)). Altyapı: Vercel Pro $20/ay, Playwright MCP/Crawlee ücretsiz, WhatsApp ihmal edilebilir, Google Places lead toplama Enterprise tier'da ~$35/1.000 Text Search (ilk 1.000/ay ücretsiz) ([openplacesapi.com](https://openplacesapi.com/blog/google-places-api-pricing)).

**İş modeli bağlamı.** Türkiye 2026 fiyat kaynakları 5–7 sayfalık hazır-tema kurumsal siteyi ajansta 8.000–25.000 TL, freelancer tabanını 12.000–15.000 TL, yarı-özel kurumsal siteyi 25.000–75.000 TL bandına koyuyor; 2026 fiyatları 2025'e göre %15–25 arttı ([Bravery Technology](https://braverytechnology.com/tr/web-sitesi-fiyatlari/), [Karekod](https://www.karekod.org/blog/web-site-fiyati/)). Pipeline'ın marjinal maliyeti tek haneli dolar olduğu için iş modeli site başı marja değil, kapanış oranına ve aylık hosting/bakım gelirine dayanır. Beklentiyi gerçekçi tut: belgelenen tek "istenmeden redesign gönderdim" deneyi (2024, n=4) 3 yanıt, 0 müşteri; 200K Reddit gönderisini tarayan 2026 analizi cold e-postayı ilk müşteri için en yavaş kanal, yüz yüze ve telefonu en hızlı buldu ([UX Planet](https://uxplanet.org/i-tried-this-viral-strategy-to-find-design-clients-part-01-ed810699c5eb), [reddit snapshot](https://reddit.sentinel-team.org/posts/1qaobz3/snapshots/2026-01-23T20%3A40%3A43.38172Z)). Mesaj, "siteni yeniledim" değil, ölçülebilir tek bir iş sorunu (mobilde menü okunmuyor, tıklanabilir telefon yok, mobil skor 43/100) + özel önizleme linki + tek evet/hayır sorusu olmalı ([Indie Hackers](https://www.indiehackers.com/post/how-to-get-more-freelance-website-redesign-clients-d80794a67b)). TÜİK 2025'e göre 10–49 çalışanlı işletmelerin yalnız %52,4'ünün sitesi var; mikro işletmelerde oran daha düşük, yani iki lead havuzun var: sitesi hiç olmayanlar (crawl atlanır, içerik Google profili ve kısa telefon görüşmesinden gelir) ve sitesi zayıf olanlar ([Alomaliye/TÜİK](https://www.alomaliye.com/2025/09/11/girisimlerde-bilisim-teknolojileri-kullanim-arastirmasi-2025/)).

**Hukuki ve etik çerçeve.** Dört katman var. *Telif ve marka:* bu alandaki her araç kullanımı "own it or have permission" şartına bağlıyor; 13K yıldızlı klonlayıcının README'si phishing, taklit ve scraping'i yasaklayan ToS'lu siteleri dışlıyor ve ticari iş için "the content owner's written consent" istiyor ([Hostinger](https://www.hostinger.com/horizons/website-cloner), [README](https://cdn.jsdelivr.net/gh/JCodesMore/ai-website-cloner-template@master/README.md)). Logo, renk ve metin yalnız o işletmeye gösterilen özel demoda kullanılır; benzer bir domain kayıt edilmez; demo bandı taklit algısını önler. *Kişi fotoğrafları:* FSEK 86 kişi fotoğraflarını sanatsal olmasa da korur ve rıza ister; TMK 24–25 tazminat, TCK 134–137 kişisel verinin hukuka aykırı yayımına ceza öngörür; KVKK tanımlayıcı fotoğrafı kişisel veri sayar ([Hukuki Haber](https://www.hukukihaber.net/kisi-fotograf-ve-goruntulerinin-izinsiz-olarak-sosyal-medya-platformlarinda-kullanilmasinin-hukuki-ve-cezai-boyutu)). Pipeline personel/müşteri fotoğraflarını rıza doğrulanana kadar bulanıklaştırmalı veya placeholder'la değiştirmeli, eski sitedeki stok görselleri `license_unknown` olarak işaretlemeli. *KVKK çerez ve aydınlatma:* Kurum'un 2022 Çerez Rehberi'ne göre analitik/reklam/sosyal eklenti çerezleri açık rıza ister, siteye girmek rıza değildir, ön işaretli kutu geçersizdir, "Reddet" "Kabul Et" kadar görünür olmalı, amaç bazlı seçim sunulmalı, onay kaydı tutulmalı ve rızadan önce üçüncü taraf script çalışmamalı ([hukukcularevi.com](https://hukukcularevi.com/cerez-politikasi-ve-cerez-onayi-kvkk/)). 2026 ceza bantları: aydınlatma yükümlülüğü 85.437–1.709.200 TL, veri güvenliği 256.357–17.092.242 TL ([CottGroup](https://cottgroup.com/en/legislation/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari)). Demo sitede analitik/reklam script'i hiç yükleme (consent yükümlülüğü doğmaz); üretim şablonunda `ConsentBanner` server-side render edilsin, GA/Meta Pixel yalnız `consent.marketing === true` sonrasında yüklensin, "Tümünü Kabul Et / Tümünü Reddet / Tercihleri Yönet" eşit stillensin ve Çerez Politikası + Aydınlatma Metni sayfaları `site.config.ts`'ten üretilsin. VERBİS genel muafiyeti 50 çalışan ve 100 milyon TL bilanço altı; ana faaliyeti özel nitelikli veri (sağlık) olan diş klinikleri gibi işletmeler için Ekim 2025'te 10 çalışan / 10 milyon TL'ye daraltıldı, bunu `legal_tr` kategorisinde "hukukçu onayı gerekir" notuyla bayrakla ([Hukuki Haber](https://www.hukukihaber.net/kisisel-verileri-koruma-kurulunun-04092025-tarihli-ve-20251572-sayili-karari-isiginda-verbis-kayit-yukumlulugunun-istisna-kapsaminda-degisimi)). ETBİS kaydı yalnız kendi sitesinden tüketiciye satış yapanlar için; kuaför/diş hekimi/avukat tanıtım sitesinde `sells_online == true` koşuluna bağlı kontrol ([FFK Partner Hukuk](https://www.ffkpartnerhukuk.com.tr/etbis-kaydi-kimler-icin-zorunludur-2026-guncel-rehber/)). *Ticari ileti:* 6563 ve yönetmelik gereği tacir/esnafa ticari elektronik ileti önceden onay gerektirmez ama ret hakkı vardır ve reddedene gönderim durmalıdır; iletişim verisini işlemek için KVKK'da ayrı bir hukuki dayanak (meşru menfaat) gerekir ([hukukcularevi.com](https://hukukcularevi.com/ticari-elektronik-ileti-iys-izin-6563-reklam/)). Pipeline'ın CRM'inde `opted_out` alanı tut ve aynı işletmeye bir daha yazma. Önemli belirsizlikler: İYS kayıt zorunluluğunun tacir/esnaf istisnasında geçerliliği, 2026 İYS ceza tutarları ve SMK 6769 (marka) açısından özel demoda logo kullanımı için Türkçe içtihat bulunamadı; bunlar bir hukukçuyla netleştirilmeli.

**Türkiye'ye özgü teknik kurallar (şablonda kod olarak):** `html lang="tr"`, `openGraph.locale: 'tr_TR'`, hreflang `tr-TR` + `x-default` ([Google](https://developers.google.com/search/docs/specialty/international/localized-versions)); `latin-ext` font alt kümesi; `Intl` `tr-TR` biçimlendirme; `toLocaleUpperCase('tr-TR')` zorunluluğu ve CSS `text-transform: uppercase`'in `lang` olmadan İ/ı hatası üretebileceği uyarısı; `tel:+90…` ve `wa.me/90…` formatı; mobilde sticky "Hemen Ara / WhatsApp'tan Yaz" CTA'sı; Google Maps Embed API (`maps/embed/v1/place`, API anahtarı gerekli, "free to use with unlimited requests") ([Google](https://developers.google.com/maps/documentation/embed/usage-and-billing)); LocalBusiness alt tipi + `openingHoursSpecification` + Türkçe gün adlarıyla görünür saat tablosu; footer'da Aydınlatma Metni ve Çerez Politikası linkleri; e-ticaret varsa Mesafeli Satış Sözleşmesi, Ön Bilgilendirme ve ETBİS şartlı kontrolü; mojibake (`Ã§`, `Ä±`, `ÅŸ`) ve `<meta charset>` denetimi eski ISO-8859-9 sitelerden gelen içeriğe karşı.

## Hafta hafta uygulama yol haritası

**Hafta 1 — İskelet ve şablon.** Vercel Pro'ya geç (ücretli iş için zorunlu). Monorepo'yu kur; `template/`'i `pnpm dlx shadcn@latest init -t next` + Next 16.4 ile başlat, `cacheComponents: true`, `ensureStatic = 'navigation'`, `@theme` token rampası, `format.ts`, `site.config.ts` + Zod şemaları, `SectionRenderer` ve 6–8 bölüm tipi (hero, services, gallery, testimonials, faq, hours, map, contact) her biri 2–3 varyantla. `eslint.config.mjs`, `playwright.config.ts`, `lighthouserc.cjs`, `tests/*.spec.ts`, `scripts/verify.mjs`'i yaz ve **elle doldurduğun** bir örnek `site.config.ts` ile tüm kapıların yeşil olduğunu doğrula. Telegram botunu kur. Çıktı: `pnpm verify` geçen, deploy edilebilir bir şablon.

**Hafta 2 — Crawl ve audit (LLM'siz).** Crawlee + Playwright crawler'ı (`robots.txt`, iki context, ekran görüntüleri, `page.evaluate` çıkarımları, metascraper logo, node-vibrant palet, `asset-manifest.json`). Lighthouse modül + PSI + axe ile `audit.ts`; `issues.json` şemasını ve severity eşlemesini kodla; `facts.json` (NAP, saatler, hizmetler, fiyatlar) üret. 5–10 gerçek Türk KOBİ sitesinde çalıştır, Cloudflare/CAPTCHA ve mojibake vakalarını topla, retry + manuel yükleme fallback'i ekle. Çıktı: `rebuild audit <url>` komutu, dakikalar içinde `runs/<id>/audit/` dolu.

**Hafta 3 — Claude Code katmanı.** `.claude/skills/{audit-narrative,plan,generate,fix}/SKILL.md`, `.claude/agents/{visual-auditor,section-builder,design-judge,fix-agent}.md`, `.claude/settings.json` hook'ları (`deploy-gate.sh`, `protect-tests.sh`, `stop-gate.sh`, prettier `PostToolUse`), `CLAUDE.md` (<150 satır), `.claude/rules/*.md`, `design-rules.md`, `acceptance.json`. Orkestratörde Agent SDK `query()` sarmalayıcısını her aşama için `model`, `maxTurns`, `maxBudgetUsd`, `outputFormat` ile yaz; `env`'den gizli anahtarları yalnız deploy aşamasına ver. Playwright MCP'yi `.pipeline/mcp.json`'a ekle. İlk uçtan uca "generate" koşusunu tek sitede yap, digest döngüsünü 3 turla sınırla. Çıktı: `rebuild generate <run-id>` kalite kapılarından geçen bir site üretiyor.

**Hafta 4 — Deploy, koruma, bildirim, tek komut.** `deploy.ts`: REST ile proje yarat → `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` → `vercel deploy --prod --yes`; `SITE_PREVIEW=1` ile noindex header + robots disallow + `proxy.ts` Basic-Auth + görünür demo bandı; `curl -I` ile `X-Robots-Tag`'ı doğrulayan otomatik kontrol. Meta Cloud API hesabı, system-user token, `site_ready` utility template onayı; `notify.ts` WhatsApp → Telegram fallback. `state.json` durum makinesi, `approve <run-id>` komutu (plan sonrası ve deploy öncesi iki insan kontrol noktası, başta açık). `rebuild <url>` tek komutunu uçtan uca bağla. Çıktı: komut → WhatsApp'ta "eski adres şu, yeni adres şu, gir bak".

**Hafta 5 — Kalite ve maliyet kalibrasyonu.** 10 siteyi koştur; `total_cost_usd`, `num_turns`, `permission_denials`, tur başına geçme oranı ve en sık başarısız kapıyı logla. Model karışımını (haiku/sonnet/opus) ve `effort` seviyelerini buna göre ayarla. `design-judge` rubriğini nötr ikili sorulara indir, ikili A/B karşılaştırmasını ekle, yargıç gerekçelerini örnekleyerek denetle. Lighthouse 13 ile LHCI 0.15.x uyumunu test et; sorun çıkarsa doğrudan `lighthouse` modülü + kendi assertion script'ine geç.

**Hafta 6 — Müşteri raporu ve lead akışı.** `issues.json` + ekran görüntüleri + Lighthouse medyanlarından Türkçe tek sayfalık "önce/sonra" raporu (kapak + 3 rakam, 375 px yan yana görüntüler, en fazla 5 kritik bulgu, KVKK durumu ve ceza bandı, NAP tablosu, 2–3 rakip skoru, sonraki adım). Apify `without_website` filtresi veya Places API ile iki lead havuzu; "sitesi yok" havuzu için crawl'ı atlayan ve Google profili + kısa görüşme notundan `facts.json` dolduran varyant. CRM'de `opted_out` ve `consent_assets` alanları.

**Hafta 7 — Sertleştirme.** Hook'lara `onFailure: "block"`, `Stop` hook'una `stop_hook_active` guard'ı, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, aşama başına `--max-budget-usd`, Bash zaman aşımları. Compaction talimatları. Eskalasyon yolu: `BLOCKED.md` → Telegram'a "insan gerekli" mesajı. Çalışma ortamını konteynere taşı (Playwright MCP Docker imajı, root olmayan kullanıcı); isteğe bağlı GitHub Actions tetikleyici (`claude-code-action@v1`, `claude_args` ile `--max-turns`, `--mcp-config`, `--allowedTools "Bash(pnpm *),Bash(npx vercel *),mcp__playwright__*"`; Bash varsayılan kapalı) ([Claude Code docs](https://code.claude.com/docs/en/github-actions)).

**Hafta 8 — Pilot satış ve geri besleme.** 10–20 işletmeye özel önizleme + tek ölçülebilir sorun formatıyla ulaş (öncelik telefon/WhatsApp/yüz yüze, e-posta son sırada). Yanıt/kapanış oranlarını kaydet; satılan projelerde `SITE_PREVIEW`'i kaldır, custom domain ekle veya projeyi transfer et; sözleşmeye içerik/görsel sahipliği ve portföy kullanım izni maddelerini koy. Düzeltme turlarında tekrar eden kalıpları `design-rules.md` ve `.claude/rules`'a geri yaz.

## Sonuç

Bu hattın asıl zorluğu kod üretmek değil, üretimin **doğrulanabilir** olmasını sağlamak: fidelity ölçülebilir (perceptual diff, verbatim başlık, grep) ama "daha iyi tasarım" ölçülemez, bu yüzden olgun açık kaynak araçların ikisi de redesign'ı reddedip klona odaklanıyor. Senin avantajın, redesign'ı iki parçaya bölmek: olgular (NAP, saatler, hizmetler, görseller) deterministik çıkarılır ve grep ile korunur; yaratıcılık yalnızca `site.config.ts` + bölüm varyantları + iki OKLCH sayısı ile sınırlı bir alanda, ikili ve nötr bir yargıç rubriğiyle denetlenir. Bu kurgu hem hallüsinasyon riskini (uydurma saat/fiyat) tasarım kalitesinden ayırır hem de maliyeti aşama başına bütçelenebilir kılar.

İkinci çıkarım, otomasyonun zayıf halkasının teknik değil ticari ve hukuki olduğu: tek belgelenmiş istenmeyen-redesign deneyi 0/4 kapattı, Vercel Hobby ücretli demo için bile kullanılamıyor, ve KVKK/FSEK çerçevesi demo'nun özel, `noindex`, analitiksiz ve kişi fotoğrafsız olmasını zorunlu kılıyor. Dolayısıyla pipeline'ı bir "satış makinesi" değil, dakikalar içinde ölçülebilir kanıt (mobil skor, eksik `tel:` linki, çerez ihlali) ve özel bir önizleme üreten **konuşma açıcı** olarak konumlandır; gelir, site başı marjdan değil kapanış sonrası hosting/bakım aboneliğinden gelir. Hafta 1'de Telegram ile başlayıp WhatsApp'ı template onayından sonra eklemek ve ilk 10 koşuda iki insan onay noktasını açık tutmak, otomasyonun güvenini kazanırken kontrolü kaybetmemenin en ucuz yolu.

## Ek A — Lead bulma aşaması (Aşama 0): sitesi olan, siteyi kullanan ve telefonu olan işletmeler

Pipeline'ın önüne deterministik bir `discover` aşaması eklenir. Hedef: **sitesi olan, siteye yatırım yapmış (dolayısıyla değerini bilen) ama sitesi zayıf, telefonu yazılı** işletmeler. "Sitesi hiç olmayan" havuz bu akıştan çıkarılır; o işletmeler site için para ödemeye alışık değildir ve aranınca ikna süresi uzundur.

### A.1 Kaynaklar

| Kaynak | Ne verir | Maliyet | Not |
|---|---|---|---|
| Google Places API (New) — Text Search | `websiteUri`, `nationalPhoneNumber`, puan, yorum sayısı, saatler, kategori | Enterprise tier ~$35/1K istek, ay 1.000 ücretsiz | En temiz veri; `fieldMask` ile sadece gereken alanları iste |
| Apify "Google Maps Scraper" | Aynı alanlar + e-posta/sosyal medya tahmini | ~$4–9/1K sonuç | Toplu tarama için daha ucuz |
| Yandex Haritalar / Yelp TR / sektörel dizinler (Doktorsitesi, Armut vb.) | Tamamlayıcı telefon + site | Ücretsiz/scraping | Yedek kaynak, kalite düşük |
| Google Business Profile "Web sitesi" butonu | Siteyi profilde göstermiş olması | — | Siteyi "kullanıyor" sinyali |

Sorgu şablonu: `"{sektör} {ilçe}"` (örn. `diş kliniği Kadıköy`, `kuaför Beşiktaş`, `avukat Şişli`). 20 sektör × 15 ilçe = 300 sorgu ≈ 3.000–6.000 ham kayıt.

### A.2 Filtre zinciri (`discover.ts`)

```ts
type Lead = {
  name: string; phone: string | null; website: string | null;
  rating: number; reviewCount: number; category: string; district: string;
  placeId: string; usesWebsite: boolean; websiteScore: number | null;
};

// 1. hard filters (deterministic, no LLM)
const hardFilter = (l: Lead) =>
  !!l.website &&                       // must have a site
  !!l.phone && /^(\+90|0)?5?\d{9,10}$/.test(l.phone.replace(/\s/g, '')) &&
  !isAggregator(l.website) &&          // skip instagram.com, facebook.com, linktr.ee, sahibinden, armut
  l.reviewCount >= 10;                 // alive business, not a ghost listing
```

`isAggregator` listesi: `instagram.com, facebook.com, linktr.ee, wa.me, sahibinden.com, armut.com, bionluk.com, doktortakvimi.com, trendyol.com, hepsiburada.com, n11.com, google.com/maps`. Bunlar "sitesi var" sayılmaz.

### A.3 "Siteyi kullanıyor" sinyalleri (`website-activity.ts`)

Siteye tek bir hafif HTTP isteği + `sitemap.xml` + ana sayfa HTML'inden, tarayıcı açmadan hesaplanır:

| Sinyal | Nasıl ölçülür | Puan |
|---|---|---|
| Domain yaşı ≥ 2 yıl | WHOIS / RDAP (`rdap.org`) | +2 |
| Son 12 ayda içerik güncellenmiş | `sitemap.xml` `<lastmod>`, blog/haber tarihleri, `Last-Modified` header, telif yılı (`© 2026`) | +3 |
| Google Business Profile'da site linki var | Places `websiteUri` dolu | +1 |
| Telefon sitede de yazılı ve Places ile eşleşiyor | regex + normalize `+90` | +2 |
| Analytics/pixel var (GA4, Meta Pixel, GTM) | HTML içinde `gtag`, `fbq`, `googletagmanager` | +2 (reklam harcıyor → siteye değer veriyor) |
| Ücretli alan adı (`.com.tr`, `.com`) ve kurumsal e-posta (`@firma.com`) | TLD + HTML'de mailto | +1 |
| Site builder bedava subdomain (`*.wixsite.com`, `*.wordpress.com`, `*.webnode`) | hostname | −3 |
| Çalışmıyor / parked / SSL hatası | HTTP ≥ 400, parked keyword, TLS error | elenir |

`usesWebsite = score >= 5`. Böylece "2019'da yaptırıp bir daha dokunmamış" ile "düzenli kullanan" ayrılır.

### A.4 Hızlı skor: "zayıf ama değerli"

Pahalı Lighthouse'u 3.000 siteye koşmak yerine iki kademe:
1. **Ucuz heuristik (hepsine, ~1 sn/site):** viewport meta yok, HTTPS yok, `tel:`/`wa.me` yok, jQuery 1.x/eski WordPress, Flash/tablo düzen, mobile'da yatay kaydırma. 3+ ihlal → aday.
2. **PSI API mobil (sadece adaylara, günde 25.000 ücretsiz kota):** performance < 50 **ve** `usesWebsite` → `tier A`.

Sıralama: `tier A` + yorum sayısı yüksek + analytics var = önce aranacak. Mantık: işletme zaten reklam/site harcaması yapıyor, kötü siteyi görüp "bunu yeniden yaptık, telefonunuzla aradık" dediğinde pazarlık masası hazır.

### A.5 Çıktı ve CRM

`leads/{district}-{sector}.csv` → `name, phone_e164, website, rating, reviews, activity_score, psi_mobile, tier, top3_issues_tr, called_at, outcome, opted_out`. Pipeline girişi `tier == 'A'` satırlarından `sites.txt` üretir; her hafta en fazla 10–20 site rebuild edilir, hepsi aranır. `opted_out` olanlar bir daha taranmaz (6563 ve KVKK gereği).

### A.6 Maliyet (aylık, ~300 sorgu / 5.000 kayıt)

- Places Text Search: 300 istek × ~20 sonuç/sayfa, 3 sayfa = ~900 istek ≈ $0 (1.000 ücretsiz) – $32.
- RDAP/WHOIS, HTTP head, PSI: ücretsiz.
- Apify alternatifi: ~$20–45.
- LLM yok; tamamı deterministik. Toplam ≈ 0–50 $/ay.

### A.7 Arama öncesi mini-rapor

Aramadan önce agent her `tier A` lead için 5 satırlık Türkçe not üretir (bu tek LLM adımı, Haiku ile ~$0.01): işletme adı, sitenin en görünür 3 eksiği, mobil skor, "yeni önizleme hazır" linki, önerilen açılış cümlesi. Telefon görüşmesinde ekranda bu durur.

## Ek B — İki giriş kapısı ve onay noktası

**Giriş 1 — Keşif (toplu):** `pipeline discover --sector "diş kliniği" --district Kadıköy` → `leads/*.csv` + Telegram/WhatsApp'a özet ("23 Tier A lead bulundu, listeyi onayla: <link>"). Pipeline burada **durur**; `status: pending_approval`.

**Onay:** Operatör listeyi görür (basit bir HTML/Sheet ya da Telegram'da numaralı liste) ve seçer: `/approve 1,4,7,12` veya CSV'de `approved=true`. Sadece onaylananlar `queue.json`'a girer. Onaysız lead rebuild edilmez; bu hem maliyet kontrolü hem de marka/KVKK açısından insan sorumluluğunu korur.

**Giriş 2 — Manuel URL:** `/rebuild https://ornek.com.tr` (Telegram bot komutu, CLI ya da Claude Code skill'i). URL doğrudan `queue.json`'a `source: manual, approved: true` olarak girer; keşif ve onay atlanır çünkü onay zaten komutun kendisidir. Telefon/NAP bilgisi Places'tan `findPlaceFromText` ile tamamlanır; bulunamazsa crawl'dan çıkarılır.

İki giriş de aynı kuyruğa düşer; kuyruktan sonraki akış (crawl → audit → generate → verify → deploy → notify) özdeştir. Her site `runs/<domain>/state.json` ile izlenir; `pipeline status` tüm kuyruğu, `pipeline retry <domain>` tek siteyi yeniden koşturur.

## Ek C — Admin paneli (`apps/admin`)

### C.1 Amaç ve ilke
Pipeline'ın tek gerçek kaynağı dosya sistemidir: `queue.json`, `runs/<domain>/state.json`, `runs/<domain>/logs/*.jsonl`, `leads/*.csv`. Admin paneli bu dosyaları **okuyan ve komut yazan** ince bir katmandır; pipeline paneli olmadan da çalışır. Böylece panel çökse iş durmaz, pipeline değişince panel kırılmaz.

### C.2 Mimari
- **Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui. Orchestrator ile aynı monorepo'da (`apps/admin`), `packages/core`'daki tipleri (`RunState`, `Lead`, `QueueItem`) paylaşır.
- **Veri katmanı:** `packages/core/src/store.ts` — SQLite (better-sqlite3 veya Drizzle) tek dosya `data/pipeline.db`; orchestrator her aşama geçişinde hem `state.json`'a hem DB'ye yazar (`runs`, `stages`, `events`, `leads`, `approvals`, `costs` tabloları). Panel sadece DB okur.
- **Canlı akış:** `GET /api/events` Server-Sent Events; orchestrator `events` tablosuna satır ekledikçe panel güncellenir. Loglar için `GET /api/runs/[id]/logs?stage=generate` ile `tail -f` benzeri stream.
- **Komutlar:** `POST /api/queue` (URL ekle), `POST /api/approvals/[batchId]` (lead onayı), `POST /api/runs/[id]/retry|cancel|promote`. Her biri orchestrator'ın CLI komutuna karşılık gelir; panel sadece çağırır.
- **Auth:** tek kullanıcı, `ADMIN_PASSWORD` + session cookie; VPS'te Cloudflare Tunnel ya da Tailscale arkasında. Vercel'e deploy edilmez (DB ve `runs/` dosya sisteminde), VPS'te `pm2`/Docker ile orchestrator'ın yanında çalışır.

### C.3 Sayfalar
| Route | İçerik |
|---|---|
| `/` Overview | Üstte 4 stat: kuyrukta / çalışıyor / bugün tamamlandı / takıldı. Altında "Running now" kartı: aktif sitenin aşama çubuğu (crawl → audit → generate → verify → deploy → notify), geçen süre, anlık token/maliyet, son 5 log satırı. Son 7 gün koşu grafiği. |
| `/runs` | Tablo: domain, kaynak (discover/manual), durum, aşama, süre, maliyet, Lighthouse öncesi→sonrası, önizleme URL. Filtre + arama. |
| `/runs/[id]` | Sol: aşama zaman çizelgesi (her aşamanın süresi, deneme sayısı, maliyeti). Orta: sekmeler — Logs (canlı), Audit (`issues.json` tablo), Facts (`facts.json` düzenlenebilir), Screenshots (eski/yeni mobil+desktop yan yana), Verify (tsc/eslint/build/LHCI/axe çıktıları, her kapı yeşil/kırmızı), Deploy. Sağ: aksiyonlar — Retry stage, Cancel, Promote (noindex kaldır), Open preview, Copy WhatsApp message. |
| `/leads` | Keşif partileri: her batch için ilçe/sektör, bulunan/Tier A sayısı, durum. Batch açılınca lead tablosu: checkbox ile seç, telefon, site, activity score, PSI mobil, ilk 3 eksik. "Approve selected → queue" butonu. `called/outcome/opted_out` alanları satır içi düzenlenir. |
| `/queue` | Sıralı kuyruk, sürükle-bırak öncelik, concurrency ayarı, "Pause queue". Üstte URL input: yapıştır → Enter → kuyruğa girer (manuel giriş kapısı). |
| `/costs` | Gün/hafta/ay bazında API maliyeti, aşama başına dağılım, site başına ortalama; bütçe eşiği uyarısı. |
| `/settings` | Model seçimi aşama başına, max retry, bütçe/site, Vercel scope, Telegram/WhatsApp hedefi, concurrency; `design-rules.md`/`build-rules.md` dosyalarını paneldan düzenleme. |

### C.4 Tasarım dili (Vercel dashboard estetiği)
Vercel'in **görsel dilini** uygula, markasını değil: logo, wordmark, "Vercel" adı, ▲ üçgen kullanılmaz; panel kendi adıyla (örn. "Forge" veya "Rebuild Console") çıkar.
- Renk: saf siyah/beyaz zemin, `#0a0a0a` dark / `#fafafa` light; gri skala 100–900 (`#ededed … #171717`); vurgu sadece durum renkleri (yeşil `#0070f3` yerine nötr mavi, başarı `#50e3c2`/`#0cce6b`, hata `#ee0000`, uyarı `#f5a623`). Renkli alan yok; renk sadece nokta/rozet/çizgi.
- Tipografi: Geist Sans + Geist Mono (`npm i geist`, açık lisanslı). Başlıklar 600 ağırlık, gövde 14 px, mono'da domain/ID/log.
- Yüzey: 1 px `border-gray-200/800` çerçeveli kartlar, 6–8 px radius, gölge yok; hover'da border koyulaşır. Sayfa genişliği 1200 px, 24 px grid.
- Navigasyon: üstte ince header (proje seçici, breadcrumb, sağda avatar), altında yatay sekme çubuğu (Overview · Runs · Leads · Queue · Costs · Settings) — Vercel proje sayfası düzeni. Sol sidebar yok.
- Bileşenler: durum noktaları (● ready / ● building / ● error / ● queued), ince progress çubuğu, mono log paneli (koyu zemin, zaman damgası soluk), command palette (`⌘K` ile domain/URL ara, komut çalıştır), toast bildirimleri, skeleton loading.
- Dark mode varsayılan, `prefers-color-scheme` + manuel toggle.

### C.5 Teslim kriterleri
- Panel `pnpm dev --filter admin` ile 10 sn'de açılır; DB yoksa boş durum ekranları gösterir.
- Orchestrator'dan bağımsız test: `pnpm seed` sahte 20 koşu + 3 batch üretir.
- Lighthouse (panelin kendisi) a11y ≥ 95; klavye ile tüm aksiyonlar.
- Canlı log gecikmesi < 1 sn (SSE).

### C.6 Yol haritasına etkisi
Hafta 4'e "admin v0" (Overview + Runs + Queue, salt okunur + URL ekleme), Hafta 6'ya "admin v1" (Leads onayı, Costs, Settings) eklenir. Panel pipeline'ın ilk 3 sitesi çalıştıktan sonra yazılır; önce veri şeması oturmalı.

## Ek D — Araç kararları: harici servisler ve skill'ler

### D.1 Kullanılmayacaklar (ve neden)
- **n8n / Make / Zapier:** Orkestrasyon zaten `apps/orchestrator` + SQLite kuyruğunda. İkinci bir workflow motoru aynı durumu iki yerde tutar, hata ayıklamayı zorlaştırır. Gerekirse ileride sadece "dış tetikleyici" (webhook → `queue add`) olarak eklenir.
- **Notion / Airtable:** Lead ve görüşme kaydı admin panelinin `/leads` sayfasında. Ekip büyürse CRM olarak bağlanır; v1'de yok.
- **LangGraph / Temporal:** Aşama sayısı sabit ve bounded; durable execution'a gerek yok. Idempotent aşamalar + `state.json` yeterli.

### D.2 Hazır skill'ler (kurulacak)
| Skill | Kaynak | Nerede kullanılır |
|---|---|---|
| `frontend-design` | `anthropics/skills` | `generate` skill'i ve `section-builder` agent'ı bunu yükler; "jenerik AI arayüzü" yasakları `design-rules.md`'ye de alıntılanır |
| `webapp-testing` | `anthropics/skills` | `verify` skill'i ve `visual-auditor` agent'ı; Playwright ile smoke/screenshot |
| `skill-creator` | `anthropics/skills` | Stage skill'lerini yazarken yapı/frontmatter doğruluğu |
| `web-design-guidelines` | `vercel-labs/agent-skills` | `design-judge` rubriğinin kaynağı; a11y/tipografi/spacing kontrolleri |
| `react-best-practices` (ve varsa Next.js perf kuralları) | `vercel-labs/agent-skills` | `build-rules.md` ve `fix-agent`; performans kapısı geçmeyince başvurulur |

Kurulum: `/plugin marketplace add anthropics/skills` ve `/plugin marketplace add vercel-labs/agent-skills` → ilgili skill'leri kur; alternatif olarak SKILL.md klasörlerini `.claude/skills/` altına kopyala (pinlenmiş, repo içinde versiyonlu — tercih edilen). Kurarken repo adlarını ve içerikleri doğrula; bu alan hızlı değişiyor.

### D.3 Kendi yazılacak skill'ler
`.claude/skills/` altında: `crawl`, `audit`, `plan`, `generate`, `verify`, `deploy`, `notify`, `discover`. Her biri `disable-model-invocation: true` (yalnızca orchestrator çağırır), `allowed-tools` kısıtlı, ilgili hazır skill'i `skills:` listesiyle yükler. Türkiye'ye özgü kurallar (WhatsApp/`tel:` CTA, KVKK banner, TL/tarih formatı, Türkçe büyük harf) yalnızca bu skill'lerde ve `design-rules.md`/`build-rules.md`'de yaşar.

### D.4 MCP sunucuları
- `@playwright/mcp` (headless, isolated) — crawl ve görsel denetim.
- `chrome-devtools-mcp` (isteğe bağlı) — performans izi ve console hataları.
Başka MCP yok; Vercel ve Telegram/WhatsApp çağrıları orchestrator'ın kendi in-process `tool()` tanımlarıyla yapılır, token model ortamına girmez.
