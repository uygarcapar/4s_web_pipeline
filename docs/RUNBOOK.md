# D10 runbook — ne kaldı, sırayla

A1 bitti. D10 toplam ~67 oturum; A1 bunun birincisiydi. Bu dosya geri kalanı
için tek kaynak: her adımda ya **senin** yapacağın bir iş vardır ya da Claude
Code'a verilecek **tek bir prompt**.

İşaretler: 🧑 = sen (korumalı dosya ya da karar) · 🤖 = Claude Code

---

## 0. Şimdi — üç operatör işi (~30 dk)

### 0.1 🧑 Hook açığını kapat

`protect-tests.sh` yalnızca Edit/Write'ı görüyor; `git apply`, `sed -i`, `>`
ile korumalı dosyalar Bash'ten değişebiliyor. `protect-bash.sh` bunu kapatır
(test edildi: `git apply 01-design-rules.patch`, `sed -i`, `>>`, `cp`, `tee`,
`python -c open(..., "w")` reddedilir; `grep`, `git diff`, `git apply --check`,
`pnpm test`, playwright çalışır).

Terminalde, repo kökünde:

```bash
git checkout main && git pull && git checkout -b ops-hooks-a0
cp ~/Downloads/protect-bash.sh .claude/hooks/protect-bash.sh
chmod +x .claude/hooks/protect-bash.sh
cp ~/Downloads/settings.json .claude/settings.json
```

### 0.2 🧑 A0 — wa.me testi (D8)

```bash
mkdir -p docs/patches/A0
cp ~/Downloads/01-smoke-whatsapp.patch docs/patches/A0/
git apply docs/patches/A0/01-smoke-whatsapp.patch
```

### 0.3 🧑 Commit et

```bash
git add .claude docs/patches/A0 template/tests/smoke.spec.ts docs/RUNBOOK.md
git commit -m "chore(hooks): guard protected files from Bash; fix(tests): wa.me only when published (A0)"
git push -u origin ops-hooks-a0
```

PR aç, merge et. Sonra Claude Code'da bir kez doğrulat:

```
Verify task A0 and the hook: run the template verify on a fixture whose
site.config has contact.whatsappE164 = null and confirm the playwright gate
passes. Then try `sed -i 's/x/x/' template/design-rules.md` and confirm the
protect-bash hook denies it. Update docs/STATUS.md (hook gap closed, A0 done)
and commit on a branch.
```

### 0.4 🧑 §13'ü cevapla

`docs/D10-design-variation.md` §13'e cevapları yaz. Hangileri neyi bloke ediyor:

| Soru | Bloke ettiği | Ne zamana kadar |
|---|---|---|
| Q1 hangi 4 direction | A3 | A2 bitmeden |
| Q2 font lisansı | A5 | A4 bitmeden |
| Q3 müşteri markası override | C2 | Faz C başlamadan |
| Q4 embedding lokal mi | C5 | Faz C başlamadan |

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
| ✅ | A1 | — | merged |
| 1 | A0 + hook | 🧑 | §0 |
| 2 | **A2** şemalar | 🤖 | |
| 3 | **A3** 4 direction + ref | 🤖 + 🧑 | Q1 lazım. Claude Code `data/corpus/shots/`'tan her direction için 6–8 aday önersin, **3–5'ini sen seç** |
| 4 | **A4** `tokens.ts` | 🤖 | |
| 5 | **A5** self-hosted font | 🤖 | Q2 lazım. Q2 gecikirse atla; kinetic-bold ve editorial-serif Google fontlarla ilerler |

### Faz B — kütüphane (asıl iş, ~39–45 oturum)

| # | Görev | Kim | Not |
|---|---|---|---|
| 6 | **B1** `/library` route | 🤖 | |
| 7 | **B2** token-only refactor + K8 | 🤖 | |
| 8 | **B3** statement/visit/closing/marquee | 🤖 | bir kısmı zaten var — önce envanter |
| 9 | **B4** arketipler, **tek tek** | 🤖 + 🧑 | aşağıya bak |

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
| 10 | C1 brief | 🤖 |
| 11 | C2 scorer + sampler | 🤖 (Q3 lazım) |
| 12 | C3 compose | 🤖 |
| 13 | C4 structural distance | 🤖 |
| 14 | C5 pre-render + embedding | 🤖 (Q4 lazım) |
| 15 | C6 kalibrasyon | 🧑 30 site çiftini etiketle (~1 saat) |

### Faz D — signature ve judge

| # | Görev | Kim |
|---|---|---|
| 16 | D1 signature + vision döngüsü | 🤖 |
| 17 | D2 judge referansları + few-shot | 🤖 |

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
