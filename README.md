# Snaga i masa

Plan treninga 4 puta nedjeljno (gornji/donji dio) sa dnevnikom serija, tajmerom odmora i objašnjenjima vježbi. Jedna stranica bez zavisnosti; podaci se čuvaju u pregledaču telefona.

- `app.fragment.html` je cijela aplikacija (CSS, markup, skripta). Mijenja se samo ovaj fajl.
- `npm run build` pravi `public/index.html` i `public/sw.js` (PWA za „Add to Home Screen” na iPhoneu).
- `npm test` gradi i provjerava da se sve skripte parsiraju.
- Push na `main` pokreće CI (GitHub Actions) i objavu na Vercelu.

Repozitorijum: https://github.com/Suksii/gymplan · Vercel projekat: `gymplan` (tim „Suksii's projects”).

## 3D animacije vježbi

Klipovi u `public/anim/` (`<id>.mp4` i `<id>.jpg`) su unaprijed iscrtani: poze iz `FIGS` u `app.fragment.html` prenose se na kosti 3D lika i snimaju kadar po kadar (headless Chrome + three.js), pa ih ffmpeg spaja.

- `tools/3d/render.cjs sheet [id,id]` crta početak, sredinu i kraj svake vježbe u `tools/3d/out/sheet.png` (za provjeru poza).
- `tools/3d/render.cjs video [id,id]` pravi klipove u `public/anim/`.
- Model nije u repozitorijumu. U `tools/3d/models/` treba staviti `Xbot.glb` (lutka s Mixamo skeletom iz three.js primjera, `examples/models/gltf/Xbot.glb`). Odjeću i kosu dodaje `render.html`: boji tijelo po kostima (majica, helanke, patike) i kači kosu na glavu. Drugi lik s Mixamo skeletom radi bez toga: `MODEL=ime.glb node render.cjs ...`.
- Stopala i oslonjene šake idu tačno na mjesto iz poze (IK na modelu); ruke koje nose teret prate pravac kostiju, a dlan se okreće prema tabeli `PALM`.
- `tools/3d/node_modules/three` (0.170) i `playwright-core` se instaliraju posebno; putanje se zadaju promjenljivima `PW` i `EXE`.
