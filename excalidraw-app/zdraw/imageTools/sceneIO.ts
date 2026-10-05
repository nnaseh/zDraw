import {
  CaptureUpdateAction,
  MIME_TYPES,
  THEME,
  convertToExcalidrawElements,
  exportToCanvas,
  newElementWith,
} from "@excalidraw/excalidraw";
import { applyDarkModeFilter } from "@excalidraw/common";
import { isImageElement } from "@excalidraw/element";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawImageElement,
  FileId,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  BinaryFileData,
  DataURL,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import type { ZDrawTheme } from "../themes";

export type CaptureSource =
  | "selection"
  | "viewport"
  | "region"
  | "scene"
  | "screen";

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load image"));
    img.src = src;
  });

export const imageToCanvas = (img: CanvasImageSource, w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/** the canvas color the user actually sees for the current theme/scene */
export const getVisibleCanvasColor = (
  api: ExcalidrawImperativeAPI,
  theme: ZDrawTheme,
) => {
  const { viewBackgroundColor, theme: base } = api.getAppState();
  if (!viewBackgroundColor || viewBackgroundColor === "transparent") {
    return theme.canvas || (base === THEME.DARK ? "#121212" : "#ffffff");
  }
  return applyDarkModeFilter(viewBackgroundColor, base === THEME.DARK);
};

const withBackground = (source: HTMLCanvasElement, color: string | null) => {
  if (!color) {
    return source;
  }
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);
  return out;
};

/**
 * Render elements the way they look on screen (theme-aware). Rendered with a
 * transparent background and composited onto the visible canvas color, since
 * Excalidraw's dark-mode filter can't produce e.g. a pure black background.
 */
export const renderElementsToCanvas = async (
  api: ExcalidrawImperativeAPI,
  elements: readonly NonDeletedExcalidrawElement[],
  opts: {
    scale?: number;
    background: string | null;
    darkMode: boolean;
    padding?: number;
    /** clip/size to this frame (elements should be the whole scene) */
    frame?: NonDeleted<ExcalidrawFrameLikeElement>;
  },
) => {
  const scale = opts.scale ?? 2;
  const canvas = await exportToCanvas({
    elements,
    appState: {
      ...api.getAppState(),
      exportBackground: false,
      viewBackgroundColor: "transparent",
      exportWithDarkMode: opts.darkMode,
      exportEmbedScene: false,
    },
    files: api.getFiles(),
    exportPadding: opts.padding ?? 16,
    exportingFrame: opts.frame,
    getDimensions: (width, height) => ({
      width: width * scale,
      height: height * scale,
      scale,
    }),
  });
  return withBackground(canvas, opts.background);
};

export const getSelectedElements = (api: ExcalidrawImperativeAPI) => {
  const { selectedElementIds } = api.getAppState();
  return api
    .getSceneElements()
    .filter((element) => selectedElementIds[element.id]);
};

export const getSingleSelectedImage = (
  api: ExcalidrawImperativeAPI,
): ExcalidrawImageElement | null => {
  const selected = getSelectedElements(api);
  if (selected.length === 1 && isImageElement(selected[0])) {
    const file = selected[0].fileId && api.getFiles()[selected[0].fileId];
    return file ? (selected[0] as ExcalidrawImageElement) : null;
  }
  return null;
};

/** grab one frame of a screen / window / tab picked by the user */
const captureScreen = async () => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture isn't supported in this browser.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (error: any) {
    throw new Error(
      error?.name === "NotAllowedError"
        ? "Screen capture was cancelled or permission was denied."
        : `Screen capture failed: ${error?.message || error}`,
    );
  }
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return imageToCanvas(video, video.videoWidth, video.videoHeight);
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
};

/** returns a canvas to edit + optional image element to replace */
export const capture = async (
  api: ExcalidrawImperativeAPI,
  theme: ZDrawTheme,
  source: CaptureSource,
): Promise<{
  canvas: HTMLCanvasElement;
  replaceTarget: ExcalidrawImageElement | null;
}> => {
  const appState = api.getAppState();
  const darkMode = appState.theme === THEME.DARK;
  const background = getVisibleCanvasColor(api, theme);

  if (source === "screen") {
    return { canvas: await captureScreen(), replaceTarget: null };
  }

  if (source === "selection") {
    const image = getSingleSelectedImage(api);
    if (image) {
      const file = api.getFiles()[image.fileId!];
      const img = await loadImage(file.dataURL);
      return {
        canvas: imageToCanvas(img, img.naturalWidth, img.naturalHeight),
        replaceTarget: image,
      };
    }
    const selected = getSelectedElements(api);
    if (selected.length) {
      return {
        canvas: await renderElementsToCanvas(api, selected, {
          background,
          darkMode,
        }),
        replaceTarget: null,
      };
    }
    // nothing selected → fall through to viewport capture
  }

  if (source === "scene") {
    const elements = api.getSceneElements();
    if (!elements.length) {
      throw new Error("The canvas is empty — nothing to capture.");
    }
    return {
      canvas: await renderElementsToCanvas(api, elements, {
        background,
        darkMode,
      }),
      replaceTarget: null,
    };
  }

  // viewport / region: grab the rendered static canvas (exactly what's on
  // screen, without selection handles which live on the interactive canvas)
  const staticCanvas = document.querySelector<HTMLCanvasElement>(
    ".excalidraw-app canvas.excalidraw__canvas.static",
  );
  if (!staticCanvas) {
    throw new Error("Couldn't find the drawing canvas to capture.");
  }
  return {
    canvas: withBackground(
      imageToCanvas(staticCanvas, staticCanvas.width, staticCanvas.height),
      background,
    ),
    replaceTarget: null,
  };
};

const randomId = () =>
  (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(
    /[^a-zA-Z0-9-]/g,
    "",
  );

const addPngFile = (
  api: ExcalidrawImperativeAPI,
  canvas: HTMLCanvasElement,
) => {
  const file: BinaryFileData = {
    id: `zdraw-${randomId()}` as FileId,
    mimeType: MIME_TYPES.png,
    dataURL: canvas.toDataURL(MIME_TYPES.png) as DataURL,
    created: Date.now(),
  };
  api.addFiles([file]);
  return file.id;
};

/** insert as a new image element centered in the viewport */
export const insertImage = (
  api: ExcalidrawImperativeAPI,
  canvas: HTMLCanvasElement,
  pixelRatio = 1,
) => {
  const fileId = addPngFile(api, canvas);
  const appState = api.getAppState();
  const zoom = appState.zoom.value;
  let width = canvas.width / pixelRatio;
  let height = canvas.height / pixelRatio;
  const maxW = (appState.width / zoom) * 0.8;
  const maxH = (appState.height / zoom) * 0.8;
  const fit = Math.min(1, maxW / width, maxH / height);
  width *= fit;
  height *= fit;
  const cx = -appState.scrollX + appState.width / zoom / 2;
  const cy = -appState.scrollY + appState.height / zoom / 2;

  const [element] = convertToExcalidrawElements([
    {
      type: "image",
      fileId,
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
    },
  ]);
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), element],
    appState: { selectedElementIds: { [element.id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return element;
};

/** swap the bitmap of an existing image element (keeps width, position) */
export const replaceImage = (
  api: ExcalidrawImperativeAPI,
  target: ExcalidrawImageElement,
  canvas: HTMLCanvasElement,
) => {
  const fileId = addPngFile(api, canvas);
  const height = target.width * (canvas.height / canvas.width);
  api.updateScene({
    elements: api.getSceneElementsIncludingDeleted().map((element) =>
      element.id === target.id
        ? newElementWith(element as ExcalidrawImageElement, {
            fileId,
            height,
            crop: null,
            status: "pending",
          })
        : element,
    ),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

export const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      MIME_TYPES.png,
    ),
  );

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const copyCanvasToClipboard = async (canvas: HTMLCanvasElement) => {
  const blob = await canvasToBlob(canvas);
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
};

export const safeFilename = (name: string, ext: string) =>
  `${
    (name || "zdraw").replace(/[\\/:*?"<>|]+/g, "-").trim() || "zdraw"
  }.${ext}`;
