// Renders the exercise animations with a rigged 3D character, frame by frame (headless Chrome + three.js), then encodes with ffmpeg.
//   node render.cjs sheet [ids]      -> out/sheet.png   (start / middle / end pose of each exercise, for checking)
//   node render.cjs video [ids]      -> ../../public/anim/<id>.mp4 and <id>.jpg (poster / thumbnail)
// Needs: playwright-core (PW env or default path below), Chrome at EXE, ffmpeg.
const fs = require("fs"), path = require("path"), http = require("http"), { execFileSync } = require("child_process");
const PW = process.env.PW || "/tmp/claude-1000/-home-suksii/b034c195-1b2c-4599-a8d2-05422ebc2d44/scratchpad/rt/node_modules/playwright-core";
const EXE = process.env.EXE || "/usr/bin/google-chrome";
const { chromium } = require(PW);
const here = __dirname, root = path.join(here, "../.."), mode = process.argv[2] || "sheet", only = process.argv[3] ? process.argv[3].split(",") : null;
const FPS = 24, W = 480, H = 600;

// the poses live in the app source: take the FIGS data and the FIG module from it
const src = fs.readFileSync(path.join(root, "app.fragment.html"), "utf8");
const a = src.indexOf("var FIGS={"), b = src.indexOf("})();", src.indexOf("var FIG=(function(){")) + 5;
fs.writeFileSync(path.join(here, "fig.gen.js"), src.slice(a, b) + "\n");

const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const f = path.join(here, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(here) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const br = await chromium.launch({ executablePath: EXE, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const sheet = mode === "sheet", w = sheet ? 300 : W, h = sheet ? 375 : H;
  const p = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on("pageerror", (e) => console.error("page error:", String(e))); p.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
  await p.goto(`${base}/render.html?w=${w}&h=${h}&dpr=${sheet ? 1 : 2}&model=${process.env.MODEL || "Michelle.glb"}`);
  await p.waitForFunction("window.ready===true", null, { timeout: 120000 });
  const ids = (await p.evaluate("window.ids")).filter((id) => !only || only.includes(id));
  const out = path.join(here, "out"); fs.mkdirSync(out, { recursive: true });
  const shot = async (file) => fs.writeFileSync(file, Buffer.from((await p.evaluate(() => document.getElementById("c").toDataURL("image/png"))).split(",")[1], "base64"));

  if (sheet) {
    const files = [];
    if (!only) { await p.evaluate("window.restPose()"); await shot(path.join(out, "rest.png")); }
    for (const id of ids) for (const k of [0, 0.5, 1]) { await p.evaluate(([i, kk]) => window.draw(i, kk), [id, k]); const f = path.join(out, `s-${id}-${k}.png`); await shot(f); files.push(f); }
    const cols = 6, rows = Math.ceil(files.length / cols);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...files.flatMap((f) => ["-i", f]), "-filter_complex",
      files.map((_, i) => `[${i}:v]`).join("") + `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join("|") + `:fill=white`, path.join(out, "sheet.png")]);
    files.forEach((f) => fs.unlinkSync(f));
    console.log("sheet", ids.length, "exercises ->", path.join(out, "sheet.png"), `(${cols}x${rows}, 2 exercises per row: start/middle/end)`);
  } else {
    const dest = path.join(root, "public/anim"); fs.mkdirSync(dest, { recursive: true });
    for (const id of ids) {
      const dir = path.join(out, id); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      const total = await p.evaluate((i) => window.total(i), id), n = Math.round(total * FPS);
      for (let i = 0; i < n; i++) { await p.evaluate(([x, s]) => window.drawAt(x, s), [id, i / FPS]); await shot(path.join(dir, String(i).padStart(4, "0") + ".png")); }
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "%04d.png"), "-vf", `scale=${W}:${H}:flags=lanczos`,
        "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "27", "-preset", "slow", "-movflags", "+faststart", "-an", path.join(dest, id + ".mp4")]);
      await p.evaluate((x) => window.draw(x, 0.5), id); await shot(path.join(dir, "poster.png"));
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(dir, "poster.png"), "-vf", `scale=${W}:${H}:flags=lanczos`, "-q:v", "5", path.join(dest, id + ".jpg")]);
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(id, n, "frames,", (fs.statSync(path.join(dest, id + ".mp4")).size / 1024).toFixed(0), "KB");
    }
  }
  await br.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
