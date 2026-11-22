# Snaga i masa

Plan treninga 4 puta nedjeljno (gornji/donji dio) sa dnevnikom serija, tajmerom odmora i objašnjenjima vježbi. Jedna stranica bez zavisnosti; podaci se čuvaju u pregledaču telefona.

- `app.fragment.html` je cijela aplikacija (CSS, markup, skripta). Mijenja se samo ovaj fajl.
- `npm run build` pravi `public/index.html` i `public/sw.js` (PWA za „Add to Home Screen” na iPhoneu).
- `npm test` gradi i provjerava da se sve skripte parsiraju.
- Push na `main` pokreće CI (GitHub Actions) i objavu na Vercelu.

Repozitorijum: https://github.com/Suksii/gymplan · Vercel projekat: `gymplan` (tim „Suksii's projects”).
