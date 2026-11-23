// Gym equipment for the offline renderer, built around the posed character so that nothing passes through the body.
// Every builder gets measurements of the character at the start pose (M0) and end pose (M1); moving parts get the current pose (M).
// World axes: X = the character's left, Y = up, Z = the way she faces. Units are metres.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const std = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const GM = {
  frame: std("#565168", 0.55, 0.35),      // painted steel tube
  steel: std("#9A96AC", 0.3, 0.8),       // bare bars, cables, guide rods
  pad: std("#3B3652", 0.85),             // vinyl upholstery
  plate: std("#4A4658", 0.6, 0.3),       // weight-stack plates
  weight: std("#A81E5B", 0.55),          // accent: selected plate, free weights
  panel: std("#C9C4D8", 0.8),            // foot plates
  mat: std("#8E86B2", 0.95),             // floor mat
};
const BT = 0.115;    // spine line to the surface of the back
const SEAT = 0.105;  // hip joint to the underside of the seated body
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const v = (x, y, z) => new THREE.Vector3(x, y, z);

export function kit(group) {
  const put = (m) => { m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const k = {
    tube(a, b, r = 0.024, mat = GM.frame) { const l = a.distanceTo(b); if (l < 1e-4) return; const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 16), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize()); return put(m); },
    box(cx, cy, cz, sx, sy, sz, mat = GM.frame, radius = 0.012) { const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(radius, sx / 2.01, sy / 2.01, sz / 2.01)), mat); m.position.set(cx, cy, cz); return put(m); },
    // upholstered board running from a to b in the side plane, `w` wide (along X), `t` thick, centred at x = cx
    board(a, b, w, t = 0.07, mat = GM.pad, cx = 0) { const l = a.distanceTo(b), m = new THREE.Mesh(new RoundedBoxGeometry(w, l, t, 4, Math.min(0.03, t / 2.01)), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5); m.position.x = cx; m.quaternion.setFromUnitVectors(Y, b.clone().sub(a).setX(0).normalize()); return put(m); },
    roller(c, len, r = 0.05, mat = GM.pad) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 6, 20), mat); m.position.copy(c); m.rotation.z = Math.PI / 2; return put(m); },
    disc(c, r, t, mat = GM.weight) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 40), mat); m.position.copy(c); m.rotation.z = Math.PI / 2; return put(m); },
    // selectorised weight stack: guide rods, plates, the selected (accent) plate
    stack(cx, cz, h = 1.55, along = "x") { const w = along === "x" ? 0.26 : 0.1, d = along === "x" ? 0.1 : 0.26;
      k.box(cx, 0.04, cz, w + 0.08, 0.08, d + 0.08); k.box(cx, h, cz, w + 0.08, 0.06, d + 0.08);
      for (const s of [1, -1]) k.tube(v(cx + (along === "x" ? s * 0.09 : 0), 0.06, cz + (along === "x" ? 0 : s * 0.09)), v(cx + (along === "x" ? s * 0.09 : 0), h, cz + (along === "x" ? 0 : s * 0.09)), 0.011, GM.steel);
      k.box(cx, 0.08 + 0.36, cz, w, 0.72, d, GM.plate, 0.006); k.box(cx, 0.08 + 0.72 + 0.022, cz, w, 0.04, d, GM.weight, 0.006); },
    // flat bench along Z: pad from z0 to z1 with its top at `top`
    bench(z0, z1, top, cx = 0, w = 0.29) { const t = 0.075, zc = (z0 + z1) / 2, len = z1 - z0;
      k.box(cx, top - t / 2, zc, w, t, len, GM.pad, 0.03); k.box(cx, top - t - 0.03, zc, 0.07, 0.06, len - 0.1);
      for (const z of [z0 + 0.12, z1 - 0.12]) { k.box(cx, (top - t - 0.03) / 2, z, 0.06, top - t - 0.03, 0.06); k.box(cx, 0.025, z, 0.5, 0.05, 0.07); } },
    // flat bench along X (the character lies or leans across it): pad centred at zc
    crossBench(top, zc, cx = 0, len = 1.15, d = 0.3) { const t = 0.075;
      k.box(cx, top - t / 2, zc, len, t, d, GM.pad, 0.03); k.box(cx, top - t - 0.03, zc, len - 0.1, 0.06, 0.07);
      for (const s of [1, -1]) { k.box(cx + s * (len / 2 - 0.12), (top - t - 0.03) / 2, zc, 0.06, top - t - 0.03, 0.06); k.box(cx + s * (len / 2 - 0.12), 0.025, zc, 0.07, 0.05, 0.5); } },
    mat(zc, len = 2.0, w = 0.7) { k.box(0, 0.006, zc, w, 0.012, len, GM.mat, 0.005); },
    // seat (and optional backrest) for upright or reclined sitting; returns the height of the seat top
    chair(M, { front, back = true, w = 0.36, backLen = 0.62 }) { const top = M.hip.y - SEAT, z0 = M.hip.z - 0.15, zc = (z0 + front) / 2;
      k.box(0, top - 0.04, zc, w, 0.08, front - z0, GM.pad, 0.03); k.box(0, (top - 0.08) / 2, zc, 0.08, top - 0.08, 0.08);
      k.box(0, 0.025, zc, 0.56, 0.05, 0.08); k.box(0, 0.025, zc - 0.08, 0.08, 0.05, front - z0 + 0.3);
      if (back) { const a = M.hip.clone().addScaledVector(M.b, BT).addScaledVector(M.uT, -0.03), b = a.clone().addScaledVector(M.uT, backLen);
        k.board(a, b, w - 0.04, 0.07); const p = M.hip.clone().addScaledVector(M.b, BT + 0.05).addScaledVector(M.uT, backLen * 0.6); k.tube(p, v(0, 0.03, Math.min(p.z - 0.12, z0 - 0.1)), 0.026); }
      return top; },
    // free-standing cable column: pulley at height `py` on the side facing -Z, weight stack behind it
    tower(zc, py, h = 2.15) { k.box(0, h / 2, zc, 0.1, h, 0.12); k.box(0, 0.025, zc - 0.2, 0.7, 0.05, 0.8); k.stack(0, zc + 0.2);
      k.box(0, h, zc + 0.1, 0.12, 0.06, 0.34); k.box(0, py, zc - 0.09, 0.05, 0.1, 0.08); k.disc(v(0, py, zc - 0.13), 0.045, 0.025, GM.steel); return v(0, py, zc - 0.13); },
  };
  return k;
}
const perp = (d) => v(0, d.z, -d.y);            // quarter turn of a side-plane direction

// ---------- fixed equipment, built once per exercise ----------
export const STATIC = {
  squat(k, M0) { const z = M0.hip.z - 0.5, W = 0.5, H = 2.1;                            // half rack behind the lifter: two uprights, spotter arms at knee height
    for (const sx of [1, -1]) { k.box(sx * W, H / 2, z, 0.07, H, 0.07); k.box(sx * W, 0.03, z + 0.2, 0.1, 0.06, 1.3); k.tube(v(sx * W, 0.03, z - 0.4), v(sx * W, 1.0, z), 0.026);
      k.box(sx * W, 0.74, z + 0.4, 0.05, 0.05, 0.8, GM.steel); k.box(sx * W, 1.42, z + 0.06, 0.05, 0.1, 0.12, GM.steel); }
    k.box(0, H, z, 2 * W + 0.07, 0.07, 0.07); k.box(0, 0.03, z - 0.4, 2 * W + 0.1, 0.06, 0.08); },
  legpress(k, M0, M1) { const { hip, uT, b } = M0, f = b.clone().negate(), rail = M0.foot.clone().sub(M1.foot).normalize(); let pd = perp(rail); if (pd.y > 0) pd.negate();
    k.board(hip.clone().addScaledVector(b, BT).addScaledVector(uT, -0.06), hip.clone().addScaledVector(b, BT).addScaledVector(uT, 0.66), 0.36);            // backrest
    const s0 = hip.clone().addScaledVector(uT, -0.118); k.board(s0.clone().addScaledVector(b, 0.16), s0.clone().addScaledVector(f, 0.3), 0.36);        // seat
    const c0 = M0.foot.clone().addScaledVector(rail, 0.115), c1 = M1.foot.clone().addScaledVector(rail, 0.115);
    for (const sx of [1, -1]) { const lo = c1.clone().addScaledVector(rail, -0.8).addScaledVector(pd, 0.3).setX(sx * 0.37), hi = c0.clone().addScaledVector(rail, 0.3).addScaledVector(pd, 0.3).setX(sx * 0.37);
      lo.y = Math.max(lo.y, 0.05); k.tube(lo, hi, 0.03); k.tube(hi, v(sx * 0.37, 0.03, hi.z), 0.028); k.box(sx * 0.37, 0.03, (lo.z + hi.z) / 2, 0.08, 0.06, hi.z - lo.z + 0.3); }
    const sb = hip.clone().addScaledVector(b, BT + 0.06).addScaledVector(uT, 0.4); k.tube(sb, v(0, 0.03, sb.z - 0.1), 0.028); k.box(0, 0.03, sb.z - 0.1, 0.82, 0.06, 0.08); k.box(0, 0.03, c0.z + 0.3, 0.82, 0.06, 0.08); },
  legext(k, M0) { STATIC._legMachine(k, M0, false); },
  legcurl(k, M0) { STATIC._legMachine(k, M0, true); },
  _legMachine(k, M0, curl) { const kn = M0.kn; k.chair(M0, { front: kn.z - 0.13 });
    for (const sx of [1, -1]) { k.tube(v(sx * 0.25, 0.03, kn.z), v(sx * 0.25, kn.y, kn.z), 0.028); k.box(sx * 0.25, 0.025, kn.z - 0.15, 0.08, 0.05, 0.7); k.disc(v(sx * 0.25, kn.y, kn.z), 0.05, 0.05, GM.frame); }
    if (curl) { const c = v(0, kn.y + 0.14, kn.z - 0.15); k.roller(c, 0.46, 0.05); for (const sx of [1, -1]) k.tube(v(sx * 0.25, c.y, c.z), v(sx * 0.25, kn.y, kn.z), 0.02); k.tube(v(-0.25, c.y, c.z), v(0.25, c.y, c.z), 0.014, GM.steel); }
    k.stack(-0.62, M0.hip.z + 0.1, 1.5, "z"); k.box(-0.42, 0.025, M0.hip.z + 0.1, 0.4, 0.05, 0.08); },
  abd(k, M0) { k.chair(M0, { front: M0.kn.z - 0.14, w: 0.42 }); k.stack(0, M0.hip.z - 0.62); k.box(0, 0.025, M0.hip.z - 0.4, 0.08, 0.05, 0.5); },
  latpd(k, M0) { const { hip, kn } = M0, top = k.chair(M0, { front: hip.z + 0.2, back: false, w: 0.34 }), zc = hip.z + 0.82, gz = M0.grip.z, H = 2.2;
    const rc = v(0, hip.y + 0.15, kn.z - 0.16); k.roller(rc, 0.5, 0.05); k.tube(rc, v(0, rc.y, zc), 0.024);                                            // thigh pads
    k.box(0, H / 2, zc, 0.1, H, 0.12); k.box(0, H, (zc + gz) / 2, 0.08, 0.08, zc - gz + 0.24); k.disc(v(0, H - 0.09, gz), 0.05, 0.03, GM.steel);
    k.stack(0, zc - 0.17); k.box(0, 0.025, zc, 0.7, 0.05, 0.1); k.box(0, 0.025, (hip.z + zc) / 2, 0.05, 0.05, zc - hip.z); return { pulley: v(0, H - 0.13, gz) }; },
  cablerow(k, M0) { const { hip, foot } = M0, top = hip.y - SEAT, z0 = hip.z - 0.24, zc = foot.z + 0.55;
    k.bench(z0, hip.z + 0.3, top, 0, 0.3);
    for (const n of ["L", "R"]) { const ft = M0["foot" + n], t = M0["toe" + n].clone().sub(ft).normalize(); let ns = perp(t); if (ns.z < 0) ns.negate();                 // foot plates behind the soles
      const c = ft.clone().addScaledVector(ns, 0.085); k.board(c.clone().addScaledVector(t, -0.12), c.clone().addScaledVector(t, 0.2), 0.14, 0.03, GM.panel, ft.x); k.tube(c.clone().addScaledVector(ns, 0.02), v(ft.x, 0.03, c.z + 0.12), 0.02); }
    const py = M0.grip.y; k.box(0, 0.85, zc, 0.1, 1.7, 0.12); k.stack(0, zc + 0.2); k.box(0, 0.025, (z0 + zc) / 2, 0.05, 0.05, zc - z0); k.box(0, 0.025, zc, 0.7, 0.05, 0.1);
    k.disc(v(0, py, zc - 0.1), 0.045, 0.025, GM.steel); return { pulley: v(0, py, zc - 0.1) }; },
  pushdown(k, M0, M1) { return { pulley: k.tower(Math.max(M0.grip.z, M1.grip.z) + 0.5, 2.0) }; },
  facepull(k, M0, M1) { return { pulley: k.tower(Math.max(M0.grip.z, M1.grip.z) + 0.75, M0.grip.y + 0.02) }; },
  hyper(k, M0) { const { hip, foot } = M0, L = foot.clone().sub(hip).normalize(); let n = perp(L); if (n.y > 0) n.negate();                     // n: towards the front of the body (floor side)
    const p0 = hip.clone().addScaledVector(L, 0.05).addScaledVector(n, 0.125), p1 = hip.clone().addScaledVector(L, 0.36).addScaledVector(n, 0.125); k.board(p0, p1, 0.42);           // thigh pad
    const fp = foot.clone().addScaledVector(L, 0.115); k.board(fp.clone().addScaledVector(n, 0.2), fp.clone().addScaledVector(n, -0.13), 0.44, 0.03, GM.panel);                     // foot plate
    const rc = foot.clone().addScaledVector(n, -0.09).addScaledVector(L, -0.03); k.roller(rc, 0.44, 0.04); for (const sx of [1, -1]) k.tube(v(sx * 0.21, rc.y, rc.z), v(sx * 0.21, fp.y, fp.z).addScaledVector(n, -0.12), 0.016);
    const a = p0.clone().lerp(p1, 0.5).addScaledVector(n, 0.07), c = fp.clone().addScaledVector(n, 0.2); k.tube(a, c, 0.03); k.tube(a, v(0, 0.03, a.z), 0.03); k.tube(c, v(0, 0.03, c.z), 0.03);
    k.box(0, 0.03, (a.z + c.z) / 2, 0.08, 0.06, Math.abs(a.z - c.z) + 0.3); k.box(0, 0.03, a.z + 0.1, 0.6, 0.06, 0.08); k.box(0, 0.03, c.z - 0.1, 0.6, 0.06, 0.08); },
  pullup(k, M0, M1) { const gz = M0.grip.z, gy = M0.grip.y, zs = gz - 0.62;
    for (const sx of [1, -1]) { k.box(sx * 0.5, (gy + 0.12) / 2, gz, 0.07, gy + 0.12, 0.07); k.box(sx * 0.5, 0.03, gz - 0.25, 0.09, 0.06, 1.0); k.tube(v(sx * 0.5, gy + 0.1, gz), v(sx * 0.12, 1.75, zs), 0.026); }
    k.tube(v(-0.5, gy, gz), v(0.5, gy, gz), 0.017, GM.steel); k.stack(0, zs, 1.8); return { pivot: v(0, 0.5, zs + 0.1) }; },
  dbbench(k, M0) { k.bench(M0.sh.z - 0.34, M0.hip.z + 0.08, Math.min(M0.hip.y, M0.sh.y) - BT); },
  incline(k, M0) { const { hip, uT, b } = M0, a = hip.clone().addScaledVector(b, BT).addScaledVector(uT, -0.02); k.board(a, a.clone().addScaledVector(uT, 0.8), 0.3);
    const top = hip.y - SEAT; k.box(0, top - 0.04, hip.z + 0.1, 0.3, 0.08, 0.34, GM.pad, 0.03); k.box(0, (top - 0.08) / 2, hip.z + 0.12, 0.07, top - 0.08, 0.07);
    const p = hip.clone().addScaledVector(b, BT + 0.05).addScaledVector(uT, 0.55); k.tube(p, v(0, 0.03, p.z - 0.08), 0.028); k.box(0, 0.025, (p.z + hip.z) / 2, 0.07, 0.05, hip.z - p.z + 0.5); k.box(0, 0.025, p.z - 0.1, 0.5, 0.05, 0.07); k.box(0, 0.025, hip.z + 0.25, 0.5, 0.05, 0.07); },
  ohp(k, M0) { k.chair(M0, { front: M0.hip.z + 0.3, backLen: 0.7 }); },
  hipthrust(k, M0, M1) { k.crossBench(M1.sh.y - 0.1, M1.sh.z - 0.12); },
  bss(k, M0) { k.crossBench(M0.footR.y - 0.055, M0.footR.z - 0.05, 0, 0.9, 0.28); },
  dbrow(k, M0) { const cx = (M0.kneeR.x + M0.gripR.x) / 2; k.bench(M0.footR.z - 0.08, M0.gripR.z + 0.16, Math.min(M0.gripR.y - 0.02, M0.kneeR.y - 0.07), cx, 0.28); },
  calf(k, M0) { k.box(0, M0.lift / 2, M0.foot.z + 0.15, 0.7, M0.lift, 0.28, GM.plate, 0.01); k.box(0, M0.lift + 0.004, M0.foot.z + 0.15, 0.7, 0.008, 0.28, GM.mat, 0.003); },
  plank(k, M0) { k.mat((M0.foot.z + M0.head.z) / 2 + 0.05); },
  pushup(k, M0) { k.mat((M0.foot.z + M0.head.z) / 2 + 0.05); },
  legraise(k, M0) { k.mat((M0.foot.z + M0.head.z) / 2); },
};

// ---------- moving parts, rebuilt every frame ----------
export const DYNAMIC = {
  legpress(k, M, M0, M1) { const rail = M0.foot.clone().sub(M1.foot).normalize(); let pd = perp(rail); if (pd.y > 0) pd.negate(); const c = M.foot.clone().addScaledVector(rail, 0.115);
    k.board(c.clone().addScaledVector(pd, 0.27), c.clone().addScaledVector(pd, -0.27), 0.62, 0.045, GM.panel);
    for (const sx of [1, -1]) { const q = c.clone().addScaledVector(pd, 0.3).addScaledVector(rail, 0.03).setX(sx * 0.37); k.tube(c.clone().addScaledVector(rail, 0.03).setX(sx * 0.3), q, 0.022);
      k.disc(q.clone().addScaledVector(rail, 0.16).setX(sx * 0.45), 0.2, 0.05); k.tube(q.clone().setX(sx * 0.37), q.clone().addScaledVector(rail, 0.16).setX(sx * 0.5), 0.02, GM.steel); } },
  legext(k, M) { DYNAMIC._lever(k, M, 1); },
  legcurl(k, M) { DYNAMIC._lever(k, M, -1); },
  _lever(k, M, side) { const shin = M.foot.clone().sub(M.kn).normalize(), c = M.foot.clone().addScaledVector(shin, -0.05).addScaledVector(perp(shin), side * 0.11);     // roller on the shin (extension) or behind the ankle (curl)
    k.roller(c, 0.42, 0.05); k.tube(v(-0.25, c.y, c.z), v(0.25, c.y, c.z), 0.014, GM.steel); for (const sx of [1, -1]) k.tube(v(sx * 0.25, M.kn.y, M.kn.z), v(sx * 0.25, c.y, c.z), 0.02); },
  abd(k, M) { for (const [n, sx] of [["L", 1], ["R", -1]]) { const kn = M["knee" + n], c = v(kn.x + sx * 0.125, kn.y + 0.01, kn.z - 0.05); k.box(c.x, c.y, c.z, 0.05, 0.2, 0.24, GM.pad, 0.02);
      k.tube(v(c.x + sx * 0.03, c.y - 0.05, c.z), v(sx * 0.2, M.hip.y - SEAT - 0.12, M.hip.z + 0.05), 0.02); } },
  pullup(k, M, M0, M1, S) { const c = M.kn.clone(); c.y -= 0.09; c.z -= 0.02; k.box(0, c.y, c.z, 0.46, 0.05, 0.27, GM.pad, 0.02);
    for (const sx of [1, -1]) k.tube(v(sx * 0.3, c.y - 0.03, c.z), v(sx * 0.3, S.pivot.y, S.pivot.z), 0.02); k.tube(v(-0.3, c.y - 0.03, c.z), v(0.3, c.y - 0.03, c.z), 0.02); },
};
// exercises whose handle hangs on a cable from a pulley returned by the static builder
export const CABLE = { latpd: 1, cablerow: 1, pushdown: 1, facepull: 1 };
