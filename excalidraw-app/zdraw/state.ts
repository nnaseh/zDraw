import { atom } from "../app-jotai";

import type { CaptureSource } from "./imageTools/sceneIO";

export type ZDrawDialog =
  | { type: "image-editor"; source: CaptureSource }
  | { type: "snapshots" }
  | { type: "export-presets" }
  | { type: "cheatsheet" }
  | { type: "firecrawl" }
  | { type: "brand-kit" }
  | null;

export const zdrawDialogAtom = atom<ZDrawDialog>(null);

/** capture dropdown open state (atom so it survives toolbar re-mounts) */
export const zdrawCaptureMenuOpenAtom = atom(false);
