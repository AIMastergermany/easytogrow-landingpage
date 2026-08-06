# CLAUDE.md — easytogrowki.de (Landingpage)

> Projektregeln. Das projektübergreifende **Grundgesetz** (`~/.claude/CLAUDE.md`) und der **Website-Blueprint** (`~/Desktop/ETG_Familie/Website_ETG_HubberChat/ETG ChatHub_Website/BLUEPRINT_Familien_Rollout_2026-07-07.md`) gelten zusätzlich und werden nicht hierher kopiert.

## Was das ist
Marketing-Landingpage der ETG-Kern-App „EasyToGrow" (der digitale Twin). Statisches HTML5 + Vanilla-JS, kein Framework/Build-Step. Ausgeliefert wird `public/`.

## Deploy
- Hosting **Netlify** (Auto-Deploy von GitHub `main`), Repo `AIMastergermany/easytogrow-landingpage`. **Push auf `main` geht direkt live.**
- Git-Mail **`aimastergermany@gmx.de`** (Pflicht).
- Nach jedem Push live verifizieren (`curl -I` 200 + Stichprobe der geänderten Datei). DNS bei **Febas** (mail-kritisch — nicht migrieren).
- Der Support-Chat-Bot läuft **nicht** hier, sondern im ETG-Backend (`velvet-creator-app`, Endpoint `/chat/support`).

## TABU (zentral gepflegt, hier nicht ändern)
- Der **„ETG Family"-Footer-Block** in `public/index.html` (+ Logos in `public/family/`) — Quelle der Wahrheit: `~/Desktop/ETG_Familie/ETG_Family_Vernetzung/family.json`. Nicht umbauen/entfernen, auch nicht bei Redesigns. Bei Bedarf: Rücksprache Andreas.
- Sprache: nie „KI"/„Chatbot"/„Automatisierung" in sichtbaren Texten (Twin-Sprache) — Ausnahme Rechtstexte. Kein „kostenlos testen", keine Rabattcodes sichtbar.
- Footer-Pflichtzeile `© 2026 EasyToGrow · Inhaber: Andreas Scheffels · easytogrowki.de` (Meta-Verification).

## Family-Fakten ändern?
Preis/Domain/Produktname eines Familienmitglieds → **nicht hier**, sondern in `family.json` (zentral) melden; Footer + alle Bots ziehen zentral nach.

## ⚖️ Parallel-Stand 06.08.2026 — Kanzlei-Endfassung (NICHT zurückbauen)
Ein paralleler Chat hat am 06.08.2026 die Kanzlei-Endfassung des Rechtscheck-Nachtrags umgesetzt — auch in diesem Repo (Git-Tag `rechtscheck-endfassung-2026-08-06`). Betroffen: Checkout-/Consent-Texte (CONSENT_VERSION 2026-08), AGB-Laufzeitklauseln, Widerrufsbelehrung, neue Seite „Vertrag widerrufen" (§ 356a, zentraler Endpoint /public/widerruf im ETG-Backend), Footer-Links. **Diese Texte sind verbindliche Kanzlei-Wortlaute — wortgleich lassen, Seiten nicht entfernen, Version nicht ändern.** Vor jeder Arbeit: `git fetch` + `git log`. Gesamtdoku: `~/Desktop/ETG_Familie/Compliance/UEBERGABE_Rechtscheck_2026-08-06.md`.
