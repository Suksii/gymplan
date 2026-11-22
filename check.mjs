// CI check: the build output exists and every script in it parses.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const html = readFileSync(new URL("public/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length < 2) throw new Error("expected the app script and the service-worker registration in index.html");
const dir = mkdtempSync(join(tmpdir(), "snaga-"));
scripts.forEach((code, i) => { const f = join(dir, `inline-${i}.js`); writeFileSync(f, code); execFileSync(process.execPath, ["--check", f], { stdio: "inherit" }); });
execFileSync(process.execPath, ["--check", new URL("public/sw.js", import.meta.url).pathname], { stdio: "inherit" });
JSON.parse(readFileSync(new URL("public/manifest.webmanifest", import.meta.url), "utf8"));
for (const need of ['id="app"', 'id="timer"', "manifest.webmanifest", "apple-touch-icon"]) if (!html.includes(need)) throw new Error("index.html is missing " + need);
console.log("ok:", scripts.length, "inline scripts, service worker and manifest are valid");
