import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ExcalidrawImageElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  clampRect,
  cropCanvas,
  flatten,
  measureCallout,
  normalizeRect,
  renderComposite,
} from "./annotations";
import {
  canvasToBlob,
  copyCanvasToClipboard,
  downloadBlob,
  insertImage,
  replaceImage,
  safeFilename,
} from "./sceneIO";

import "./ImageEditorDialog.scss";

import type { Annotation, Point, Rect, ToolId } from "./annotations";

type HistoryEntry = { base: HTMLCanvasElement; annotations: Annotation[] };

const TOOLS: { id: ToolId; label: string; key: string; hint: string }[] = [
  { id: "arrow", label: "Arrow", key: "a", hint: "Drag from tail to tip" },
  { id: "rect", label: "Box", key: "r", hint: "Drag to outline an area" },
  {
    id: "callout",
    label: "Callout",
    key: "c",
    hint: "Drag from the target point to where the bubble goes",
  },
  { id: "step", label: "Step", key: "n", hint: "Click to drop numbered steps" },
  { id: "pixelate", label: "Blur", key: "b", hint: "Drag to pixelate an area" },
  {
    id: "redact",
    label: "Redact",
    key: "x",
    hint: "Drag to black out an area",
  },
  {
    id: "spotlight",
    label: "Spotlight",
    key: "s",
    hint: "Drag to keep an area lit and dim the rest",
  },
  {
    id: "magnify",
    label: "Magnify",
    key: "m",
    hint: "Drag from the center outwards to place a magnifier",
  },
  {
    id: "crop",
    label: "Crop",
    key: "k",
    hint: "Drag a crop area, then press Enter or Apply crop",
  },
];

const COLORS = [
  "#da3633",
  "#fb8500",
  "#ffd60a",
  "#2da44e",
  "#2f81f7",
  "#8957e5",
  "#ffffff",
  "#000000",
];

export type ImageEditorProps = {
  excalidrawAPI: ExcalidrawImperativeAPI;
  source: HTMLCanvasElement;
  /** image element the edit came from (enables "Replace") */
  replaceTarget: ExcalidrawImageElement | null;
  initialTool?: ToolId;
  title?: string;
  /** device pixel ratio the capture was taken at (for sane insert size) */
  pixelRatio?: number;
  defaultColor?: string;
  onClose: () => void;
};

export const ImageEditorDialog = ({
  excalidrawAPI,
  source,
  replaceTarget,
  initialTool = "arrow",
  title = "Image tools",
  pixelRatio = 1,
  defaultColor = COLORS[0],
  onClose,
}: ImageEditorProps) => {
  const [base, setBase] = useState<HTMLCanvasElement>(source);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [tool, setTool] = useState<ToolId>(initialTool);
  const [color, setColor] = useState(defaultColor);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [calloutText, setCalloutText] = useState("Note");
  const [pixelBlock, setPixelBlock] = useState(12);
  const [magnifyZoom, setMagnifyZoom] = useState(2);
  const [spotDim, setSpotDim] = useState(0.6);
  const [exportScale, setExportScale] = useState(1);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // callback ref (state) so we re-render if the dialog re-mounts the canvas
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  canvasRef.current = canvasEl;
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  rootRef.current = rootEl;
  const dragStart = useRef<Point | null>(null);

  // keep keyboard focus inside the editor so tool hotkeys don't reach the
  // whiteboard behind the dialog
  // (the dialog portal mounts its children a tick later, hence state ref)
  useEffect(() => {
    if (!rootEl) {
      return;
    }
    const id = window.setTimeout(() => rootEl.focus({ preventScroll: true }));
    return () => window.clearTimeout(id);
  }, [rootEl]);

  // fallback: if focus is still outside the dialog (e.g. a key pressed before
  // the focus tick, or after clicking the backdrop), swallow the key so it
  // doesn't drive the whiteboard, honor Escape and pull focus back in
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!rootEl) {
      return;
    }
    const onWindowKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && rootEl.closest(".Modal")?.contains(active)) {
        return;
      }
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      rootEl.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onWindowKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onWindowKeyDown, {
        capture: true,
      });
  }, [rootEl]);

  // annotation sizes scale with the image so they stay readable on big
  // captures (e.g. 2x/3x HiDPI screenshots)
  const unit = useMemo(
    () => Math.max(1, Math.max(base.width, base.height) / 1200),
    [base],
  );

  const nextStep = useMemo(
    () =>
      annotations.reduce(
        (n, a) => (a.type === "step" ? Math.max(n, a.n) : n),
        0,
      ) + 1,
    [annotations],
  );

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-49), { base, annotations }]);
    setRedoStack([]);
  }, [base, annotations]);

  const commit = useCallback(
    (annotation: Annotation) => {
      pushHistory();
      setAnnotations((list) => [...list, annotation]);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    if (!history.length) {
      return;
    }
    const prev = history[history.length - 1];
    setRedoStack((r) => [...r, { base, annotations }]);
    setBase(prev.base);
    setAnnotations(prev.annotations);
    setHistory(history.slice(0, -1));
  }, [history, base, annotations]);

  const redo = useCallback(() => {
    if (!redoStack.length) {
      return;
    }
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [...h, { base, annotations }]);
    setBase(next.base);
    setAnnotations(next.annotations);
    setRedoStack(redoStack.slice(0, -1));
  }, [redoStack, base, annotations]);

  const applyCrop = useCallback(() => {
    if (!cropRect || cropRect.w < 4 || cropRect.h < 4) {
      return;
    }
    // flatten current annotations into the bitmap, then crop
    const flat = flatten(base, annotations, 1);
    pushHistory();
    setBase(cropCanvas(flat, cropRect));
    setAnnotations([]);
    setCropRect(null);
    setTool("arrow");
  }, [cropRect, base, annotations, pushHistory]);

  // -------------------------------------------------------------------------
  // render
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    const canvas = canvasEl;
    if (!canvas) {
      return;
    }
    if (canvas.width !== base.width || canvas.height !== base.height) {
      canvas.width = base.width;
      canvas.height = base.height;
    }
    const ctx = canvas.getContext("2d")!;
    renderComposite(ctx, base, draft ? [...annotations, draft] : annotations);

    if (cropRect && tool === "crop") {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.rect(0, 0, base.width, base.height);
      ctx.rect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.fill("evenodd");
      ctx.setLineDash([8 * unit, 6 * unit]);
      ctx.lineWidth = 2 * unit;
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.restore();
    }
  }, [canvasEl, base, annotations, draft, cropRect, tool, unit]);

  // -------------------------------------------------------------------------
  // pointer interaction
  // -------------------------------------------------------------------------
  const toImagePoint = (event: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * base.width,
      y: ((event.clientY - rect.top) / rect.height) * base.height,
    };
  };

  const buildDraft = (from: Point, to: Point): Annotation | null => {
    const rect = clampRect(normalizeRect(from, to), base.width, base.height);
    const width = strokeWidth * unit;
    switch (tool) {
      case "arrow":
        return { type: "arrow", from, to, color, width };
      case "rect":
        return { type: "rect", rect, color, width };
      case "callout":
        return {
          type: "callout",
          tip: from,
          center: to,
          text: calloutText,
          color,
          fontSize: Math.round(18 * unit),
        };
      case "pixelate":
        return { type: "pixelate", rect, block: Math.round(pixelBlock * unit) };
      case "redact":
        return { type: "redact", rect };
      case "spotlight":
        return { type: "spotlight", rect, dim: spotDim };
      case "magnify":
        return {
          type: "magnify",
          center: from,
          radius: Math.hypot(to.x - from.x, to.y - from.y),
          zoom: magnifyZoom,
          color,
        };
      default:
        return null;
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) {
      return;
    }
    rootRef.current?.focus({ preventScroll: true });
    const point = toImagePoint(event);
    if (tool === "step") {
      commit({
        type: "step",
        at: point,
        n: nextStep,
        color,
        radius: Math.round(16 * unit),
      });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = point;
    if (tool === "crop") {
      setCropRect({ x: point.x, y: point.y, w: 0, h: 0 });
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const from = dragStart.current;
    if (!from) {
      return;
    }
    const to = toImagePoint(event);
    if (tool === "crop") {
      setCropRect(clampRect(normalizeRect(from, to), base.width, base.height));
      return;
    }
    setDraft(buildDraft(from, to));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const from = dragStart.current;
    dragStart.current = null;
    if (!from) {
      return;
    }
    const to = toImagePoint(event);
    setDraft(null);
    if (tool === "crop") {
      return;
    }
    const isClick = Math.hypot(to.x - from.x, to.y - from.y) < 4 * unit;
    if (tool === "callout" && isClick) {
      // click-only callout: place the bubble up-right of the point
      const m = measureCallout(
        canvasRef.current!.getContext("2d")!,
        calloutText,
        Math.round(18 * unit),
      );
      commit({
        type: "callout",
        tip: from,
        center: { x: from.x + m.w * 0.75, y: from.y - m.h * 1.5 },
        text: calloutText,
        color,
        fontSize: Math.round(18 * unit),
      });
      return;
    }
    if (isClick) {
      return;
    }
    const annotation = buildDraft(from, to);
    if (annotation) {
      commit(annotation);
    }
  };

  // -------------------------------------------------------------------------
  // keyboard (scoped to the dialog; don't leak to the editor behind it)
  // -------------------------------------------------------------------------
  const onKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select")) {
      return;
    }
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }
    if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (event.key === "Enter" && tool === "crop") {
      event.preventDefault();
      applyCrop();
      return;
    }
    if (!mod && !event.altKey) {
      const match = TOOLS.find((t) => t.key === event.key.toLowerCase());
      if (match) {
        setTool(match.id);
      }
    }
  };

  // -------------------------------------------------------------------------
  // output
  // -------------------------------------------------------------------------
  const output = () => flatten(base, annotations, exportScale);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2500);
  };

  useEffect(() => {
    if (tool !== "crop") {
      setCropRect(null);
    }
  }, [tool]);

  const activeTool = TOOLS.find((t) => t.id === tool)!;
  const showColor = !["pixelate", "redact", "spotlight", "crop"].includes(tool);
  const showStroke = tool === "arrow" || tool === "rect";

  return (
    <Dialog
      onCloseRequest={onClose}
      title={title}
      size={1280}
      className="zdraw-image-editor-dialog"
      autofocus={false}
    >
      <div
        className="zdraw-image-editor"
        onKeyDown={onKeyDown}
        tabIndex={-1}
        ref={setRootEl}
      >
        <div className="zdraw-image-editor__tools" role="toolbar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === tool ? "is-active" : ""}
              onClick={() => setTool(t.id)}
              title={`${t.label} (${t.key.toUpperCase()}) — ${t.hint}`}
              data-testid={`zdraw-image-tool-${t.id}`}
            >
              <span>{t.label}</span>
              <kbd>{t.key.toUpperCase()}</kbd>
            </button>
          ))}
          <div className="zdraw-image-editor__sep" />
          <button type="button" onClick={undo} disabled={!history.length}>
            <span>Undo</span>
            <kbd>⌘Z</kbd>
          </button>
          <button type="button" onClick={redo} disabled={!redoStack.length}>
            <span>Redo</span>
            <kbd>⇧⌘Z</kbd>
          </button>
          <button
            type="button"
            onClick={() => {
              if (annotations.length) {
                pushHistory();
                setAnnotations([]);
              }
            }}
            disabled={!annotations.length}
          >
            <span>Clear marks</span>
          </button>
        </div>

        <div className="zdraw-image-editor__stage">
          <canvas
            ref={setCanvasEl}
            className={`zdraw-image-editor__canvas tool-${tool}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragStart.current = null;
              setDraft(null);
            }}
          />
          <div className="zdraw-image-editor__statusbar">
            <span>{activeTool.hint}</span>
            <span>
              {base.width}×{base.height}px
              {status ? ` · ${status}` : ""}
            </span>
          </div>
        </div>

        <div className="zdraw-image-editor__panel">
          {showColor && (
            <section>
              <h4>Color</h4>
              <div className="zdraw-image-editor__colors">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={c === color}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Custom color"
                />
              </div>
            </section>
          )}
          {showStroke && (
            <section>
              <h4>Stroke · {strokeWidth}px</h4>
              <input
                type="range"
                min={1}
                max={16}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
              />
            </section>
          )}
          {tool === "callout" && (
            <section>
              <h4>Callout text</h4>
              <textarea
                rows={2}
                value={calloutText}
                onChange={(e) => setCalloutText(e.target.value)}
              />
            </section>
          )}
          {tool === "step" && (
            <section>
              <h4>Next step</h4>
              <div className="zdraw-image-editor__hint">#{nextStep}</div>
            </section>
          )}
          {tool === "pixelate" && (
            <section>
              <h4>Block size · {pixelBlock}px</h4>
              <input
                type="range"
                min={4}
                max={40}
                value={pixelBlock}
                onChange={(e) => setPixelBlock(Number(e.target.value))}
              />
            </section>
          )}
          {tool === "magnify" && (
            <section>
              <h4>Zoom · {magnifyZoom}×</h4>
              <input
                type="range"
                min={1.5}
                max={4}
                step={0.5}
                value={magnifyZoom}
                onChange={(e) => setMagnifyZoom(Number(e.target.value))}
              />
            </section>
          )}
          {tool === "spotlight" && (
            <section>
              <h4>Dim · {Math.round(spotDim * 100)}%</h4>
              <input
                type="range"
                min={0.2}
                max={0.9}
                step={0.05}
                value={spotDim}
                onChange={(e) => setSpotDim(Number(e.target.value))}
              />
            </section>
          )}
          {tool === "crop" && (
            <section>
              <h4>Crop</h4>
              <div className="zdraw-image-editor__row">
                <button
                  type="button"
                  className="zdraw-btn zdraw-btn--primary"
                  disabled={!cropRect || cropRect.w < 4 || cropRect.h < 4}
                  onClick={applyCrop}
                >
                  Apply crop
                </button>
                <button
                  type="button"
                  className="zdraw-btn"
                  onClick={() => setCropRect(null)}
                >
                  Reset
                </button>
              </div>
              {cropRect && (
                <div className="zdraw-image-editor__hint">
                  {Math.round(cropRect.w)}×{Math.round(cropRect.h)}px
                </div>
              )}
            </section>
          )}

          <section className="zdraw-image-editor__output">
            <h4>Output scale</h4>
            <div className="zdraw-image-editor__segmented">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={s === exportScale}
                  onClick={() => setExportScale(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
            <button
              type="button"
              className="zdraw-btn zdraw-btn--primary"
              onClick={() => {
                insertImage(excalidrawAPI, output(), pixelRatio * exportScale);
                onClose();
              }}
            >
              Insert into drawing
            </button>
            {replaceTarget && (
              <button
                type="button"
                className="zdraw-btn"
                onClick={() => {
                  replaceImage(excalidrawAPI, replaceTarget, output());
                  onClose();
                }}
              >
                Replace selected image
              </button>
            )}
            <button
              type="button"
              className="zdraw-btn"
              onClick={async () => {
                try {
                  await copyCanvasToClipboard(output());
                  flash("Copied PNG");
                } catch (error: any) {
                  flash(`Copy failed: ${error?.message || error}`);
                }
              }}
            >
              Copy PNG
            </button>
            <button
              type="button"
              className="zdraw-btn"
              onClick={async () => {
                const blob = await canvasToBlob(output());
                downloadBlob(
                  blob,
                  safeFilename(`${excalidrawAPI.getName()}-capture`, "png"),
                );
                flash("Downloaded");
              }}
            >
              Download PNG
            </button>
          </section>
        </div>
      </div>
    </Dialog>
  );
};
