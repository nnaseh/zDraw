/**
 * zDraw image tools — annotation model + renderer.
 *
 * Everything is in image-pixel coordinates of the current base bitmap.
 * Rendering is a pure function of (base, annotations), so output can be
 * re-rendered at any scale for crisp exports.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type Annotation =
  | { type: "arrow"; from: Point; to: Point; color: string; width: number }
  | { type: "rect"; rect: Rect; color: string; width: number }
  | {
      type: "callout";
      tip: Point;
      center: Point;
      text: string;
      color: string;
      fontSize: number;
    }
  | { type: "step"; at: Point; n: number; color: string; radius: number }
  | { type: "pixelate"; rect: Rect; block: number }
  | { type: "redact"; rect: Rect }
  | { type: "spotlight"; rect: Rect; dim: number }
  | {
      type: "magnify";
      center: Point;
      radius: number;
      zoom: number;
      color: string;
    };

export type ToolId =
  | "arrow"
  | "rect"
  | "callout"
  | "step"
  | "pixelate"
  | "redact"
  | "spotlight"
  | "magnify"
  | "crop";

export const normalizeRect = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});

export const clampRect = (r: Rect, width: number, height: number): Rect => {
  const x = Math.max(0, Math.min(r.x, width));
  const y = Math.max(0, Math.min(r.y, height));
  return {
    x,
    y,
    w: Math.max(0, Math.min(r.x + r.w, width) - x),
    h: Math.max(0, Math.min(r.y + r.h, height) - y),
  };
};

const FONT = (size: number) =>
  `600 ${size}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;

const readableTextOn = (hex: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) {
    return "#fff";
  }
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => parseInt(c, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#000" : "#fff";
};

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  a: Extract<Annotation, { type: "arrow" }>,
) => {
  const { from, to, color, width } = a;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = Math.max(10, width * 4);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // shaft stops at the base of the head so the tip stays sharp
  const baseX = to.x - Math.cos(angle) * head * 0.8;
  const baseY = to.y - Math.sin(angle) * head * 0.8;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(baseX, baseY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - head * Math.cos(angle - Math.PI / 7),
    to.y - head * Math.sin(angle - Math.PI / 7),
  );
  ctx.lineTo(
    to.x - head * Math.cos(angle + Math.PI / 7),
    to.y - head * Math.sin(angle + Math.PI / 7),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

export const measureCallout = (
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
) => {
  ctx.save();
  ctx.font = FONT(fontSize);
  const lines = (text || " ").split("\n");
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width));
  ctx.restore();
  const padX = fontSize * 0.75;
  const padY = fontSize * 0.5;
  return {
    lines,
    w: width + padX * 2,
    h: lines.length * fontSize * 1.25 + padY * 2,
    padX,
    padY,
  };
};

const drawCallout = (
  ctx: CanvasRenderingContext2D,
  a: Extract<Annotation, { type: "callout" }>,
) => {
  const { tip, center, text, color, fontSize } = a;
  const m = measureCallout(ctx, text, fontSize);
  const x = center.x - m.w / 2;
  const y = center.y - m.h / 2;
  const r = Math.min(8, m.h / 3);
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  // tail: a wedge from the box center to the tip
  const tailWidth = Math.min(m.w, m.h) * 0.35;
  const angle = Math.atan2(tip.y - center.y, tip.x - center.x);
  ctx.beginPath();
  ctx.moveTo(
    center.x + Math.cos(angle + Math.PI / 2) * tailWidth,
    center.y + Math.sin(angle + Math.PI / 2) * tailWidth,
  );
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(
    center.x + Math.cos(angle - Math.PI / 2) * tailWidth,
    center.y + Math.sin(angle - Math.PI / 2) * tailWidth,
  );
  ctx.closePath();
  ctx.fill();
  // box
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + m.w, y, x + m.w, y + m.h, r);
  ctx.arcTo(x + m.w, y + m.h, x, y + m.h, r);
  ctx.arcTo(x, y + m.h, x, y, r);
  ctx.arcTo(x, y, x + m.w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // text
  ctx.fillStyle = readableTextOn(color);
  ctx.font = FONT(fontSize);
  ctx.textBaseline = "top";
  m.lines.forEach((line, i) => {
    ctx.fillText(line, x + m.padX, y + m.padY + i * fontSize * 1.25);
  });
  ctx.restore();
};

const drawStep = (
  ctx: CanvasRenderingContext2D,
  a: Extract<Annotation, { type: "step" }>,
) => {
  ctx.save();
  ctx.fillStyle = a.color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(2, a.radius * 0.15);
  ctx.beginPath();
  ctx.arc(a.at.x, a.at.y, a.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = readableTextOn(a.color);
  ctx.font = FONT(Math.round(a.radius * 1.1));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(a.n), a.at.x, a.at.y + a.radius * 0.05);
  ctx.restore();
};

const drawPixelate = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  a: Extract<Annotation, { type: "pixelate" }>,
) => {
  const { rect, block } = a;
  if (rect.w < 1 || rect.h < 1) {
    return;
  }
  const sw = Math.max(1, Math.round(rect.w / block));
  const sh = Math.max(1, Math.round(rect.h / block));
  const tmp = document.createElement("canvas");
  tmp.width = sw;
  tmp.height = sh;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, sw, sh);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, sw, sh, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
};

const drawMagnify = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  a: Extract<Annotation, { type: "magnify" }>,
) => {
  const { center, radius, zoom, color } = a;
  if (radius < 2) {
    return;
  }
  const srcR = radius / zoom;
  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(
    source,
    center.x - srcR,
    center.y - srcR,
    srcR * 2,
    srcR * 2,
    center.x - radius,
    center.y - radius,
    radius * 2,
    radius * 2,
  );
  ctx.restore();
  ctx.lineWidth = Math.max(2, radius * 0.04);
  ctx.strokeStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();
};

const drawSpotlights = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spots: Extract<Annotation, { type: "spotlight" }>[],
) => {
  if (!spots.length) {
    return;
  }
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${spots[spots.length - 1].dim})`;
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  spots.forEach(({ rect }) => {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  });
  ctx.fill("evenodd");
  ctx.restore();
};

/**
 * Render base + annotations into `ctx` (already sized to base * scale).
 * Order: redactions (operate on the base pixels) → magnifiers (see redacted
 * pixels) → spotlight dim → vector annotations on top.
 */
export const renderComposite = (
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  annotations: readonly Annotation[],
  scale = 1,
) => {
  const { width, height } = base;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(base, 0, 0);

  // 1) redactions, rendered into a working copy so magnifiers see them
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const wctx = work.getContext("2d")!;
  wctx.drawImage(base, 0, 0);
  for (const a of annotations) {
    if (a.type === "pixelate") {
      drawPixelate(wctx, base, a);
    } else if (a.type === "redact") {
      wctx.fillStyle = "#000";
      wctx.fillRect(a.rect.x, a.rect.y, a.rect.w, a.rect.h);
    }
  }
  ctx.drawImage(work, 0, 0);

  // 2) magnifiers
  for (const a of annotations) {
    if (a.type === "magnify") {
      drawMagnify(ctx, work, a);
    }
  }

  // 3) spotlight
  drawSpotlights(
    ctx,
    width,
    height,
    annotations.filter(
      (a): a is Extract<Annotation, { type: "spotlight" }> =>
        a.type === "spotlight",
    ),
  );

  // 4) vector annotations
  for (const a of annotations) {
    switch (a.type) {
      case "arrow":
        drawArrow(ctx, a);
        break;
      case "rect":
        ctx.save();
        ctx.strokeStyle = a.color;
        ctx.lineWidth = a.width;
        ctx.lineJoin = "round";
        ctx.strokeRect(a.rect.x, a.rect.y, a.rect.w, a.rect.h);
        ctx.restore();
        break;
      case "callout":
        drawCallout(ctx, a);
        break;
      case "step":
        drawStep(ctx, a);
        break;
    }
  }
  ctx.restore();
};

/** flatten to a new canvas at the given scale */
export const flatten = (
  base: HTMLCanvasElement,
  annotations: readonly Annotation[],
  scale = 1,
) => {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(base.width * scale));
  out.height = Math.max(1, Math.round(base.height * scale));
  renderComposite(out.getContext("2d")!, base, annotations, scale);
  return out;
};

export const cropCanvas = (source: HTMLCanvasElement, rect: Rect) => {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(rect.w));
  out.height = Math.max(1, Math.round(rect.h));
  out
    .getContext("2d")!
    .drawImage(
      source,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      0,
      0,
      out.width,
      out.height,
    );
  return out;
};
