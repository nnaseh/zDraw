import { THEME, exportToSvg } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  canvasToBlob,
  copyCanvasToClipboard,
  downloadBlob,
  getSelectedElements,
  getVisibleCanvasColor,
  renderElementsToCanvas,
  safeFilename,
} from "./imageTools/sceneIO";

import type { PdfMode } from "./pdf";
import type { ZDrawTheme } from "./themes";

export type ExportPresetId =
  | "png-theme-2x"
  | "png-light-2x"
  | "png-transparent-2x"
  | "png-slide-1080p"
  | "svg-light"
  | "clipboard-theme"
  | "pdf-drawing"
  | "pdf-pages"
  | "pdf-slides";

export type ExportPreset = {
  id: ExportPresetId;
  label: string;
  description: string;
};

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  {
    id: "png-theme-2x",
    label: "PNG 2× · as on screen",
    description: "Current theme colors and canvas background",
  },
  {
    id: "png-light-2x",
    label: "PNG 2× · light",
    description: "Original colors on a white background (docs, print)",
  },
  {
    id: "png-transparent-2x",
    label: "PNG 2× · transparent",
    description: "Original colors, no background (overlays, stickers)",
  },
  {
    id: "png-slide-1080p",
    label: "Slide 1920×1080",
    description: "Fitted and centered on a 16:9 slide in the current theme",
  },
  {
    id: "svg-light",
    label: "SVG · light",
    description: "Scalable vector, white background",
  },
  {
    id: "clipboard-theme",
    label: "Copy PNG to clipboard",
    description: "As on screen, 2×",
  },
  {
    id: "pdf-drawing",
    label: "PDF · one page",
    description: "Whole drawing (or selection) on a single light page",
  },
  {
    id: "pdf-pages",
    label: "PDF · pages",
    description: "One page per frame, else per top-level group",
  },
  {
    id: "pdf-slides",
    label: "PDF · slides 1920×1080",
    description: "One 16:9 slide per frame/group, in the current theme",
  },
];

export const fitIntoSlide = (
  source: HTMLCanvasElement,
  background: string,
  width = 1920,
  height = 1080,
  margin = 0.06,
) => {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const availW = width * (1 - margin * 2);
  const availH = height * (1 - margin * 2);
  const scale = Math.min(availW / source.width, availH / source.height);
  const w = source.width * scale;
  const h = source.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
  return out;
};

/** runs a preset on the selection (if any) or the whole drawing */
export const runExportPreset = async (
  api: ExcalidrawImperativeAPI,
  theme: ZDrawTheme,
  id: ExportPresetId,
) => {
  const selected = getSelectedElements(api);
  const elements = selected.length ? selected : api.getSceneElements();
  if (!elements.length) {
    throw new Error("The canvas is empty — nothing to export.");
  }
  const name = api.getName();
  const isDark = api.getAppState().theme === THEME.DARK;
  const visibleBg = getVisibleCanvasColor(api, theme);

  switch (id) {
    case "pdf-drawing":
    case "pdf-pages":
    case "pdf-slides": {
      // lazy: keeps pdf-lib out of the main bundle
      const { exportPdf } = await import("./pdf");
      return exportPdf(api, theme, elements, id.slice(4) as PdfMode);
    }
    case "png-theme-2x":
    case "clipboard-theme": {
      const canvas = await renderElementsToCanvas(api, elements, {
        scale: 2,
        background: visibleBg,
        darkMode: isDark,
      });
      if (id === "clipboard-theme") {
        await copyCanvasToClipboard(canvas);
        return "Copied PNG to clipboard";
      }
      downloadBlob(await canvasToBlob(canvas), safeFilename(name, "png"));
      return "Exported PNG";
    }
    case "png-light-2x": {
      const canvas = await renderElementsToCanvas(api, elements, {
        scale: 2,
        background: "#ffffff",
        darkMode: false,
      });
      downloadBlob(await canvasToBlob(canvas), safeFilename(name, "png"));
      return "Exported PNG";
    }
    case "png-transparent-2x": {
      const canvas = await renderElementsToCanvas(api, elements, {
        scale: 2,
        background: null,
        darkMode: false,
      });
      downloadBlob(await canvasToBlob(canvas), safeFilename(name, "png"));
      return "Exported transparent PNG";
    }
    case "png-slide-1080p": {
      const canvas = await renderElementsToCanvas(api, elements, {
        scale: 3,
        background: null,
        darkMode: isDark,
      });
      const slide = fitIntoSlide(canvas, visibleBg);
      downloadBlob(
        await canvasToBlob(slide),
        safeFilename(`${name}-slide`, "png"),
      );
      return "Exported slide";
    }
    case "svg-light": {
      const svg = await exportToSvg({
        elements,
        appState: {
          ...api.getAppState(),
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
          exportWithDarkMode: false,
        },
        files: api.getFiles(),
        exportPadding: 16,
      });
      const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      });
      downloadBlob(blob, safeFilename(name, "svg"));
      return "Exported SVG";
    }
  }
};
