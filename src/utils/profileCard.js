import { createCanvas, loadImage, registerFont } from "canvas";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = resolve(__dirname, "..", "..", "fonts");

const FONTS_MAP = [
  { id: "bangers",       file: "Bangers.ttf",       family: "Bangers",         weight: "normal" },
  { id: "biorhyme",      file: "BioRhyme.ttf",       family: "BioRhyme",        weight: "normal" },
  { id: "cherrybombone", file: "CherryBombOne.ttf",  family: "Cherry Bomb One", weight: "normal" },
  { id: "chicle",        file: "Chicle.ttf",         family: "Chicle",          weight: "normal" },
  { id: "compagnon",     file: "Compagnon.otf",      family: "Compagnon",       weight: "normal" },
  { id: "jollylodger",   file: "JollyLodger.ttf",    family: "Jolly Lodger",    weight: "normal" },
  { id: "medievalsharp", file: "MedievalSharp.ttf",  family: "MedievalSharp",   weight: "normal" },
  { id: "museomoderno",  file: "MuseoModerno.ttf",   family: "Museo Moderno",   weight: "normal" },
  { id: "pixelifysans",  file: "PixelifySans.ttf",   family: "Pixelify Sans",   weight: "normal" },
  { id: "ribes",         file: "Ribes.otf",          family: "Ribes",           weight: "900"    },
  { id: "ribesregular",  file: "Ribes-Regular.otf",  family: "Ribes",           weight: "normal" },
  { id: "ribeslight",    file: "Ribes-Light.otf",    family: "Ribes",           weight: "300"    },
  { id: "zillaslab",     file: "ZillaSlab.ttf",      family: "Zilla Slab",      weight: "normal" },
];

for (const font of FONTS_MAP) {
  const fontPath = join(FONTS_DIR, font.file);
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: font.family, weight: font.weight });
  }
}

const WIDTH  = 800;
const HEIGHT = 560;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFontFamily(fontId) {
  const entry = FONTS_MAP.find((f) => f.id === fontId);
  return entry ? entry.family : "Zilla Slab";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ─── Lightning bolts ─────────────────────────────────────────────────────────

function drawLightningBolt(ctx, cx, cy, size, angle) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // outer white glow
  ctx.shadowColor = "#bf80ff";
  ctx.shadowBlur = 18;

  ctx.beginPath();
  ctx.moveTo(4, -size);
  ctx.lineTo(-3, -size * 0.05);
  ctx.lineTo(3.5, -size * 0.05);
  ctx.lineTo(-4, size);
  ctx.lineTo(2, size * 0.12);
  ctx.lineTo(-3, size * 0.12);
  ctx.closePath();

  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.restore();
}

function drawAvatarLightning(ctx, cx, cy, radius) {
  const bolts = [
    { angle: -0.6,  orbitOffset: 10, size: 20, rotation:  0.35 },
    { angle:  0.5,  orbitOffset:  8, size: 17, rotation: -0.45 },
    { angle:  1.7,  orbitOffset: 12, size: 22, rotation:  0.65 },
    { angle:  2.9,  orbitOffset: 10, size: 19, rotation: -0.25 },
    { angle: -2.3,  orbitOffset:  9, size: 18, rotation:  0.55 },
    { angle: -1.15, orbitOffset:  8, size: 16, rotation: -0.65 },
  ];
  for (const { angle, orbitOffset, size, rotation } of bolts) {
    const r  = radius + orbitOffset;
    const bx = cx + Math.cos(angle) * r;
    const by = cy + Math.sin(angle) * r;
    drawLightningBolt(ctx, bx, by, size, angle + rotation);
  }
}

// ─── Info boxes ───────────────────────────────────────────────────────────────

function drawInfoBoxes(ctx, startY, location, age, profession, family) {
  const boxW   = 200;
  const boxH   = 90;
  const boxGap = 20;
  const totalW = boxW * 3 + boxGap * 2;
  const startX = (WIDTH - totalW) / 2;
  const cornerR = 14;

  const fields = [
    { label: "LOCATION",   value: location   },
    { label: "AGE",        value: age        },
    { label: "PROFESSION", value: profession },
  ];

  for (let i = 0; i < fields.length; i++) {
    const bx    = startX + (boxW + boxGap) * i;
    const field = fields[i];

    // box — semi-transparent dark fill
    ctx.fillStyle = "rgba(30, 31, 36, 0.82)";
    roundRect(ctx, bx, startY, boxW, boxH, cornerR);
    ctx.fill();

    // border
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, bx, startY, boxW, boxH, cornerR);
    ctx.stroke();

    // label
    ctx.fillStyle = "#6b6d78";
    ctx.font = `bold 11px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(field.label, bx + boxW / 2, startY + 26);

    // value
    ctx.fillStyle = "#e3e5e8";
    ctx.font = `22px ${family}`;
    let val = String(field.value || "Not set");
    const maxW = boxW - 24;
    while (ctx.measureText(val).width > maxW && val.length > 3) {
      val = val.slice(0, -1);
    }
    if (val !== String(field.value || "Not set")) val += "…";
    ctx.fillText(val, bx + boxW / 2, startY + 62);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function generateProfileCard(data) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext("2d");

  const family = getFontFamily(data.fontId);

  // ── 1. Rounded card clip ─────────────────────────────────────────────────
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 24);
  ctx.clip();

  // ── 2. Background ────────────────────────────────────────────────────────
  // Always start with a solid dark base
  ctx.fillStyle = "#1a1b1e";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const BANNER_H = 260; // how tall the banner section is

  const bannerUrl = data.nitroBannerUrl || data.bannerUrl || null;

  if (bannerUrl) {
    // ── Has banner: draw it only in the top portion, blurred + darkened ──
    try {
      const img = await loadImage(bannerUrl);
      ctx.save();
      // clip to banner region only
      ctx.beginPath();
      ctx.rect(0, 0, WIDTH, BANNER_H);
      ctx.clip();
      ctx.filter = "blur(6px) brightness(0.5) saturate(1.1)";
      ctx.drawImage(img, -10, -10, WIDTH + 20, BANNER_H + 20);
      ctx.filter = "none";
      ctx.restore();

      // gradient fade from banner into dark body
      const fade = ctx.createLinearGradient(0, BANNER_H - 100, 0, BANNER_H + 40);
      fade.addColorStop(0, "rgba(26,27,30,0)");
      fade.addColorStop(1, "rgba(26,27,30,1)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, BANNER_H - 100, WIDTH, 140);
    } catch {
      // banner failed to load — nothing extra needed, dark base is already there
    }
  } else if (data.avatarUrl) {
    // ── No banner: blur avatar across the full card (like your Josh card) ──
    try {
      const av = await loadImage(data.avatarUrl);
      ctx.save();
      ctx.filter = "blur(28px) brightness(0.38) saturate(1.2)";
      ctx.drawImage(av, -40, -40, WIDTH + 80, HEIGHT + 80);
      ctx.filter = "none";
      ctx.restore();
    } catch {}
  }

  // ── 3. Dark vignette overlay ─────────────────────────────────────────────
  const vignette = ctx.createRadialGradient(
    WIDTH / 2, HEIGHT / 2, HEIGHT * 0.15,
    WIDTH / 2, HEIGHT / 2, HEIGHT * 0.85,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0.18)");
  vignette.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── 4. Avatar ────────────────────────────────────────────────────────────
  const AVATAR_SIZE = 150;
  const AVATAR_R    = AVATAR_SIZE / 2;
  const AVATAR_CX   = WIDTH / 2;
  const AVATAR_CY   = 210;

  // Only draw the neon ring + lightning when the user has a Nitro decoration
  if (data.decorationURL) {
    // Outermost diffuse purple glow
    ctx.save();
    ctx.shadowColor = "#9b30ff";
    ctx.shadowBlur  = 60;
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R + 16, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(155,48,255,0)";
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();

    // Bright neon purple ring
    ctx.save();
    ctx.shadowColor = "#bf00ff";
    ctx.shadowBlur  = 35;
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R + 10, 0, Math.PI * 2);
    ctx.strokeStyle = "#9b30ff";
    ctx.lineWidth   = 7;
    ctx.stroke();
    ctx.restore();

    // Thin bright inner ring
    ctx.save();
    ctx.shadowColor = "#d580ff";
    ctx.shadowBlur  = 15;
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#cc66ff";
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    ctx.restore();

    // Lightning bolts
    ctx.save();
    drawAvatarLightning(ctx, AVATAR_CX, AVATAR_CY, AVATAR_R + 10);
    ctx.restore();
  }

  // Avatar image (always drawn, clipped to circle)
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_R, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  try {
    const avatar = await loadImage(data.avatarUrl);
    ctx.drawImage(avatar, AVATAR_CX - AVATAR_R, AVATAR_CY - AVATAR_R, AVATAR_SIZE, AVATAR_SIZE);
  } catch {
    ctx.fillStyle = "#2b2d31";
    ctx.fillRect(AVATAR_CX - AVATAR_R, AVATAR_CY - AVATAR_R, AVATAR_SIZE, AVATAR_SIZE);
  }
  ctx.restore();

  // Nitro decoration overlay (drawn on top of avatar)
  if (data.decorationURL) {
    try {
      const deco     = await loadImage(data.decorationURL);
      const decoSize = AVATAR_R * 2.9;
      ctx.drawImage(deco, AVATAR_CX - decoSize / 2, AVATAR_CY - decoSize / 2, decoSize, decoSize);
    } catch {}
  }

  // ── 5. Username ──────────────────────────────────────────────────────────
  const USERNAME_Y = AVATAR_CY + AVATAR_R + 44;

  ctx.fillStyle    = "#f2f3f5";
  ctx.font         = `bold 32px ${family}`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor  = "rgba(0,0,0,0.6)";
  ctx.shadowBlur   = 8;
  ctx.fillText(data.username || "Username", WIDTH / 2, USERNAME_Y);
  ctx.shadowBlur = 0;

  // ── 6. Tagline ───────────────────────────────────────────────────────────
  const TAGLINE_Y = USERNAME_Y + 34;
  ctx.fillStyle    = "#9b9da3";
  ctx.font         = `italic 17px ${family}`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.tagline || "", WIDTH / 2, TAGLINE_Y);

  // ── 7. Divider ───────────────────────────────────────────────────────────
  let cursorY = TAGLINE_Y + 26;

  const divGrad = ctx.createLinearGradient(80, cursorY, WIDTH - 80, cursorY);
  divGrad.addColorStop(0,    "rgba(255,255,255,0)");
  divGrad.addColorStop(0.2,  "rgba(255,255,255,0.13)");
  divGrad.addColorStop(0.8,  "rgba(255,255,255,0.13)");
  divGrad.addColorStop(1,    "rgba(255,255,255,0)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(80, cursorY);
  ctx.lineTo(WIDTH - 80, cursorY);
  ctx.stroke();

  cursorY += 18;

  // ── 8. Description ───────────────────────────────────────────────────────
  if (data.description) {
    ctx.fillStyle    = "#8b8d96";
    ctx.font         = `15px ${family}`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    const maxDescW = WIDTH - 140;
    const words    = data.description.split(" ");
    let line       = "";
    const lines    = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxDescW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    const displayLines = lines.slice(0, 2);
    if (lines.length > 2) {
      displayLines[1] = displayLines[1].replace(/\s*\S+$/, "…");
    }

    for (const l of displayLines) {
      ctx.fillText(l, WIDTH / 2, cursorY);
      cursorY += 22;
    }
    cursorY += 10;
  }

  // ── 9. Info boxes ────────────────────────────────────────────────────────
  const boxesY = cursorY + 8;
  drawInfoBoxes(ctx, boxesY, data.location, data.age, data.profession, family);

  // ── 10. Line below info boxes ─────────────────────────────────────────────
  const boxH       = 90;
  const lineY      = boxesY + boxH + 18;
  const lineGrad   = ctx.createLinearGradient(80, lineY, WIDTH - 80, lineY);
  lineGrad.addColorStop(0,   "rgba(255,255,255,0)");
  lineGrad.addColorStop(0.2, "rgba(255,255,255,0.13)");
  lineGrad.addColorStop(0.8, "rgba(255,255,255,0.13)");
  lineGrad.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(80, lineY);
  ctx.lineTo(WIDTH - 80, lineY);
  ctx.stroke();

  return canvas.toBuffer();
}
