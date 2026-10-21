# D10 runbook — ne kaldı, sırayla

A1, A0, hook ve A0b bitti (`main` @ `e9a1681`). D10 toplam ~67 oturum. Bu
dosya geri kalanı için tek kaynak: her adımda ya **senin** yapacağın bir iş
vardır ya da Claude Code'a verilecek **tek bir prompt**.

İşaretler: 🧑 = sen (korumalı dosya ya da karar) · 🤖 = Claude Code

Durum: **Faz A bitti**; B1 ve B2 de bitti (**K8 kapandı**). Operatör
bekleyen bir şey yok. Sıradaki **B4** — ve B4'ün her oturumu senin
`/library` incelemenle bitiyor, merge'den önce durur. Faz B'nin asıl yükü B4: her arketipte senin `/library`
incelemenle bitiyor (`pnpm --filter @pipeline/library dev`, :3106).

---

## 0. Operatör işleri

### 0.1 ✅ Hook açığı kapandı

`protect-tests.sh` yalnızca Edit/Write'ı görüyordu; `git apply`, `sed -i`, `>`
ile korumalı dosyalar Bash'ten değişebiliyordu. `protect-bash.sh` kapattı
(`7ef0e77`, PR #3). Ajan oturumundan doğrulandı: `sed -i`, `>` ve korumalı
dosyaya dokunan `git apply` reddedildi, `git apply --check -R` geçti,
`design-rules.md` probelardan sonra bit bit aynı kaldı.

Açık kalan tek şey, hook'un yanlış pozitifleri — en can sıkıcısı korumalı bir
dosya adını anan `git commit -m`. Ayrıntı: `docs/STATUS.md`, Open 2.

### 0.2 ✅ A0 — wa.me testi (D8)

`docs/patches/A0/01-smoke-whatsapp.patch` uygulandı (`7ef0e77`).
`smoke.spec.ts` artık config'e bakıyor: numara yayımlanmamışsa sticky bar'da
`wa.me` linki **olmayacak**. `whatsappE164: null` fixture'ında 14/14 test
geçti.

### 0.3 ✅ Doğrulama yapıldı

PR #4. Doğrulama sırasında geometry gate'in hiç çalışmadığı çıktı — A0b bundan
doğdu (§2.1, PR #6).

### 0.4 ✅ §13 cevaplandı (2026-10-22)

Dördü de kapandı; Faz A ve Faz C'de operatör bekleyen hiçbir şey yok.

| Soru | Cevap | Serbest kalan |
|---|---|---|
| Q1 hangi 4 direction | §4.3'teki dördü; `warm-craft` backlog'da | A3 |
| Q2 font lisansı | yalnız ücretsiz self-hosted (OFL vb.), foundry lisansı alınmıyor | A5 |
| Q3 müşteri markası override | yumuşak, **yalnız hue**; logo yüzü hiç alınmıyor | C2 |
| Q4 embedding | yalnız lokal; müşteri render'ı dışarı çıkmıyor | C5 |

Gerekçeler: `docs/D10-design-variation.md` §13.

**Q2'nin bir sonucu var:** `design-rules.md` §6 ve `build-rules.md` §4'teki
"lisans kararı bekliyor" ifadesi artık geçersiz. İkisi de korumalı, o yüzden
yama olarak hazır — 🧑 uygula:

```bash
git apply docs/patches/A5/01-font-licence.patch
```

---

## 1. Standart döngü — her 🤖 görevi için aynı

Her görev **ayrı bir oturum**. Plan mode'da başlat, planı oku, onayla.

```
Read docs/D10-design-variation.md §12, task <ID>, and every section it cites.
Read docs/STATUS.md. Plan first.

Do task <ID> exactly as written. Its "Done when" is the acceptance test:
prove it with a test, not a claim.

Rules:
- Branch: task-<id>. Conventional commits. Never commit to main.
- If the task needs a protected file, write a patch under docs/patches/<ID>/
  and stop; do not apply it.
- If D10 is wrong or incomplete for this task, say so and propose the fix
  to D10 in the same branch rather than working around it.
- End: pnpm typecheck, lint, test green; update docs/STATUS.md (done,
  open items, next task).
```

Oturum bitince 🧑: diff'e bak → PR → merge → bir sonraki ID.

---

## 2. Sıra

### Faz A — varyasyonu mümkün kıl

| # | Görev | Kim | Not |
|---|---|---|---|
| ✅ | A1 | — | merged, PR #1 |
| ✅ | A0 + hook | — | merged, PR #3 · doğrulandı PR #4 |
| ✅ | **A0b** template kendi verify'ını geçsin | — | merged, PR #6 · §2.1 |
| ✅ | **A2** şemalar | — | merged · 3 şema + 22 test · D10 §4.2 düzeltildi (motion.required) |
| ✅ | **A3** 4 direction + ref | — | merged, PR #11 · 4 direction + 16 referans · seçimler olduğu gibi onaylandı |
| ✅ | **A4** `tokens.ts` | — | merged · spec → tokens.css, direction başına snapshot · §4 invariantları kodda |
| ✅ | **A5** self-hosted font | — | merged · 11 OFL yüz vendor'landı, Türkçe render ile kanıtlandı · **Faz A bitti** |

### 2.1 ✅ A0b — template kendi verify'ını geçiyor (PR #6)

A0 doğrulanırken çıktı: `verify.mjs` geometry gate'i `playwright` paketini
import ediyordu, o paket `apps/orchestrator`'ın bağımlılığı. Gate hiç
çalışmamıştı; son gate olduğu ve hard fail ettiği için her verify 1 ile çıkmış
ve `.pipeline/verify-passed` hiç yazılmamıştı — yani §7 örtüşme ve dokunma
hedefi kontrolleri bugüne kadar hiç koşmadı. Import düzeltildi, gate çalıştı ve
template'in kendi fixture'ında kırmızı yandı.

**a. §7 dokunma hedefleri.** Gate rapordan viewport başına altı satır
gösteriyor, o yüzden "344×882'de dört ihlal" görünen kısmıydı: matris boyunca
her etkileşimli öğe ölçüldüğünde **18 ayrı ihlal** çıktı — hero ve iletişim
CTA'ları (36px), telefon ve e-posta linkleri (18px), dört SSS satırı (24px),
harita butonu (36px), üç çerez butonu (32px), iki yasal link (17px) ve
**genişlikten** düşen bir nav linki (40px). Zemin `buttonVariants`'ın base
sınıfına kondu (`min-h-11 min-w-11`), çünkü `min-height` variant'ın `h-*`'ını
yener — yani ileride bir bölümün seçeceği variant'ta da geçerli. Yüksekliği
değişmemesi gereken satırlarda `site-nav.tsx`'in zaten kullandığı negatif
margin deyimi. 12 viewport'un hepsinde sıfır ihlal.

**b. D8 kenar durumu.** `resolveCta`, `resolveCtaHref`'in yerine geçti:
`{href, label}` döndürüyor ve numara yoksa **ikisini de** düşürüyor. Önce
yalnızca href düşüyordu, yani hero'da "WhatsApp'tan Yaz" yazan bir buton
`tel:`'e bağlıydı — hiçbir gate'in yakalayamadığı bir hata, çünkü href geçerli
ve etiket içerik.

Diğer uç prompt satırı değil, şema refine'ı: plan aşaması markdown spec
yazıyor, `whatsapp` action'ı `generate` `site.config.ts`'i yazarken seçiliyor.
Dolayısıyla gerçekten zorlayabilen sınır `siteConfigSchema` — modül yükleme
anındaki `.parse()` kötü planı **build hatasına** çeviriyor. Plan prompt'u da
kuralı söylüyor ki planlayıcı boşa build yakmasın.

**c. Fixture.** `template/fixtures/null-whatsapp.config.ts` — WhatsApp yok,
`legalName` yok, gün eşlenmiş saat yok; tek bayrak değil, D8 düşüş yolunun
tamamı. `VERIFY_FIXTURE=<path> pnpm run verify` fixture'ı yerine koyup bütün
gate'leri çalıştırıyor ve `site.config.ts`'i `finally` ile üst seviye
`catch`'te geri yazıyor — çökme bir müşterinin config'ini üzerine yazılmış
bırakmamalı.

İki bilinçli karar: fixture koşusu `--ignore-snapshots` geçiyor (görsel
baseline'lar müşteriye özel ve gitignore'lu, fixture'ı müşterinin baseline'ıyla
karşılaştırmak iki ayrı siteyi karşılaştırmak olur) ve
`.pipeline/verify-passed` **yazmıyor** — o şekil için gate'lerin geçtiğini
kanıtlar, bu müşterinin sitesinin gönderilebilir olduğunu kanıtlamaz, ve
marker'ı deploy hook'u okuyor. Done-when marker'ı istiyordu; onu yazan
varsayılan koşu, ki yazması gereken tek koşu o.

*Sonuç:* iki koşu da 0 ile çıkıyor, workspace typecheck 0 / lint 0 / 159 test.
Ayrıntı: `docs/STATUS.md` → "A0b".

### Faz B — kütüphane (asıl iş, ~39–45 oturum)

| # | Görev | Kim | Not |
|---|---|---|---|
| ✅ | **B1** `/library` route | — | merged · `apps/library` ayrı uygulama (gerekçe STATUS'ta) · `pnpm --filter @pipeline/library dev`, :3106 |
| ✅ | **B2** token-only refactor + K8 | — | merged · **K8 kapandı**: calm fixture Lenis'siz, entrance'sız, pin'siz render ediyor · her iki fixture'da verify 0 |
| ✅ | **B3** statement/visit/closing/marquee | — | merged · statement/visit zaten vardı; **closing ve marquee hiç yoktu**, eklendi · `/library` artık 13 arketip |
| 5 | **B4** arketipler, **tek tek** | 🤖 + 🧑 | aşağıya bak |

B4 döngüsü, her arketip için:

```
Task B4, one archetype: <section>/<archetype-name>.
Composition references: <2–3 paths from data/corpus/shots/>.
Take composition only — no copy, branding or distinctive artwork.
Done when: it renders in /library under all four directions at desktop and
mobile, reads only tokens, passes invariants in isolation. Then stop for my
review in /library.
```

🧑 `/library`'de 4 direction × 2 viewport'a bak → onay ya da red + neden.
İlk 3 B4 oturumunun maliyetini not et; kalan bütçeyi ondan hesapla.

Sıra: hero (7) → services (5) → team (4) → gallery (4) → visit (3) →
process (3) → statement, faq, closing, testimonials (2'şer) → marquee (1).

### Faz C — seçim ve çeşitlilik (B4 ile paralel başlayabilir)

A2 + A4 merged ve her section tipinde en az 2 arketip olunca:

| # | Görev | Kim |
|---|---|---|
| 9 | C1 brief | 🤖 |
| 10 | C2 scorer + sampler | 🤖 (Q3 lazım) |
| 11 | C3 compose | 🤖 |
| 12 | C4 structural distance | 🤖 |
| 13 | C5 pre-render + embedding | 🤖 (Q4 lazım) |
| 14 | C6 kalibrasyon | 🧑 30 site çiftini etiketle (~1 saat) |

### Faz D — signature ve judge

| # | Görev | Kim |
|---|---|---|
| 15 | D1 signature + vision döngüsü | 🤖 |
| 16 | D2 judge referansları + few-shot | 🤖 |

### Ship testi 🧑

10 gerçek KOBİ sitesi, en az 3 sektör, pipeline'dan geçir. Desktop fold'ları
yan yana koy: hiçbir ikisini "aynı site" diye gruplayamıyorsan D10 bitti.

### Faz E — ship'ten sonra, kütüphaneyi büyütme

E1 → E5, standart döngü. İlk batch 5 site; maliyeti ölç, sonra büyüt.

---

## 3. Ne zaman durup bana (ya da yeni bir sohbete) gelmeli

- Bir görev 2 oturumda bitmiyorsa — görev yanlış bölünmüş.
- Claude Code D10'un yanlış olduğunu söylüyorsa — karar senin.
- B4'te üst üste 3 arketip reddediyorsan — referans seçimi ya da direction
  tanımı sorunlu, arketip değil.
- Ship testinde iki site benzer çıkarsa — mesafe eşiği değil, kütüphane
  yetersiz; yeni arketip/direction lazım.
