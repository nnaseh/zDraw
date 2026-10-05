import { THEME } from "@excalidraw/excalidraw";
import { isFrameLikeElement } from "@excalidraw/element";
import { PDFDocument } from "pdf-lib";

import type {
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { fitIntoSlide } from "./exportPresets";
import {
  canvasToBlob,
  downloadBlob,
  getVisibleCanvasColor,
  renderElementsToCanvas,
  safeFilename,
} from "./imageTools/sceneIO";

import type { ZDrawTheme } from "./themes";

export type PdfMode = "drawing" | "pages" | "slides";

type Page = {
  elements: readonly NonDeletedExcalidrawElement[];
  frame?: NonDeleted<ExcalidrawFrameLikeElement>;
};

/** one page per frame; else per top-level group (+ ungrouped); else one page */
const getPages = (
  api: ExcalidrawImperativeAPI,
  elements: readonly NonDeletedExcalidrawElement[],
): Page[] => {
  const frames = elements.filter(isFrameLikeElement);
  if (frames.length) {
    const scene = api.getSceneElements();
    return frames.map((frame) => ({ elements: scene, frame }));
  }
  const groups = new Map<string, NonDeletedExcalidrawElement[]>();
  const loose: NonDeletedExcalidrawElement[] = [];
  for (const element of elements) {
    const outer = element.groupIds[element.groupIds.length - 1];
    if (outer) {
      groups.set(outer, [...(groups.get(outer) || []), element]);
    } else {
      loose.push(element);
    }
  }
  const pages = [...groups.values()].map((group) => ({ elements: group }));
  return pages.length
    ? loose.length
      ? [...pages, { elements: loose }]
      : pages
    : [{ elements }];
};

export const exportPdf = async (
  api: ExcalidrawImperativeAPI,
  theme: ZDrawTheme,
  elements: readonly NonDeletedExcalidrawElement[],
  mode: PdfMode,
) => {
  const pages = mode === "drawing" ? [{ elements }] : getPages(api, elements);
  const slides = mode === "slides";
  const isDark = api.getAppState().theme === THEME.DARK;
  const background = slides ? getVisibleCanvasColor(api, theme) : "#ffffff";

  const doc = await PDFDocument.create();
  doc.setTitle(api.getName() || "zDraw");
  doc.setCreator("zDraw");

  for (const page of pages) {
    let canvas = await renderElementsToCanvas(api, page.elements, {
      scale: slides ? 3 : 2,
      background: slides ? null : background,
      darkMode: slides && isDark,
      frame: page.frame,
    });
    if (slides) {
      canvas = fitIntoSlide(canvas, background);
    }
    const png = await doc.embedPng(
      new Uint8Array(await (await canvasToBlob(canvas)).arrayBuffer()),
    );
    // 2 canvas px per PDF point (1920×1080 slides → 960×540 pt)
    const width = canvas.width / 2;
    const height = canvas.height / 2;
    doc.addPage([width, height]).drawImage(png, { x: 0, y: 0, width, height });
  }

  const bytes = await doc.save();
  downloadBlob(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
    safeFilename(
      `${api.getName()}${mode === "drawing" ? "" : `-${mode}`}`,
      "pdf",
    ),
  );
  return `Exported PDF (${pages.length} page${pages.length > 1 ? "s" : ""})`;
};
