// Builds public/index.html and public/sw.js (standalone PWA) from app.fragment.html.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("./", import.meta.url);
const src = readFileSync(new URL("app.fragment.html", root), "utf8");
const cut = src.indexOf('<header class="top">');
if (cut < 0) throw new Error("app.fragment.html: <header class=\"top\"> not found");
const head = src.slice(0, cut), body = src.slice(cut);
const ver = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
const page = `<!doctype html>
<html lang="sr-Latn-ME">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F5F4F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14121B" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Snaga i masa">
<meta name="robots" content="noindex">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}html{-webkit-text-size-adjust:100%}button,a{-webkit-tap-highlight-color:transparent;touch-action:manipulation}</style>
${head}</head>
<body>
${body}
<script>if("serviceWorker" in navigator)window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});</script>
</body>
</html>
`;
writeFileSync(new URL("public/index.html", root), page);
const sw = readFileSync(new URL("sw.template.js", root), "utf8").replaceAll("__VER__", ver);
writeFileSync(new URL("public/sw.js", root), sw);
console.log("built", ver);
