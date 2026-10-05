import { THEME } from "@excalidraw/excalidraw";

import type { Theme } from "@excalidraw/element/types";

/**
 * zDraw themes.
 *
 * Each theme sits on top of one of Excalidraw's two base themes (light/dark),
 * which drive element color mapping on the canvas, and then overrides the
 * editor's CSS custom properties (`--island-bg-color`, `--color-primary`, ...)
 * for the UI chrome. Themes with `canvas` set paint the canvas background via
 * CSS (the scene's `viewBackgroundColor` is set to "transparent"), which lets
 * dark themes use true black / GitHub-dark canvases that the base dark-mode
 * color filter can't produce.
 */

export type ZDrawThemeId =
  | "black-red"
  | "github-dark"
  | "midnight"
  | "high-contrast"
  | "github-light"
  | "classic-light";

export type ZDrawTheme = {
  id: ZDrawThemeId;
  label: string;
  base: Theme;
  /** CSS canvas color; null = classic behavior (scene viewBackgroundColor) */
  canvas: string | null;
  /** apply the dense/hairline "Primer-style" design layer */
  dense: boolean;
  /** swatch colors for the picker: [surface, accent] */
  swatch: [string, string];
  vars: Record<string, string>;
};

type Palette = {
  canvas: string;
  surface: string; // panels / islands
  surfaceAlt: string; // inset / secondary surface
  surfaceHover: string;
  border: string;
  borderMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentEmphasis: string;
  accentMuted: string; // selected-tool bg tint
  accentOn: string; // text on accent bg
  danger: string;
  overlay: string;
};

const paletteToVars = (
  p: Palette,
  isDark: boolean,
): Record<string, string> => ({
  "--zdraw-canvas": p.canvas,
  "--zdraw-border": p.border,
  "--zdraw-border-muted": p.borderMuted,
  "--zdraw-text-muted": p.textMuted,
  "--zdraw-accent": p.accent,
  "--zdraw-accent-on": p.accentOn,

  "--default-bg-color": p.canvas,
  "--island-bg-color": p.surface,
  "--island-bg-color-alt": p.surfaceAlt,
  "--popup-bg-color": p.surface,
  "--popup-secondary-bg-color": p.surfaceAlt,
  "--popup-text-color": p.text,
  "--sidebar-bg-color": p.surface,
  "--sidebar-border-color": p.border,
  "--default-border-color": p.border,
  "--dialog-border-color": p.border,
  "--input-bg-color": p.surfaceAlt,
  "--input-border-color": p.border,
  "--input-hover-bg-color": p.surfaceHover,
  "--input-label-color": p.textMuted,
  "--button-hover-bg": p.surfaceHover,
  "--button-active-bg": p.surfaceHover,
  "--button-active-border": p.accent,
  "--button-gray-1": p.surfaceHover,
  "--button-gray-2": p.surfaceAlt,
  "--button-gray-3": p.borderMuted,
  "--overlay-bg-color": p.overlay,
  "--keybinding-color": p.textMuted,
  "--link-color": p.accent,
  "--link-color-hover": p.accentHover,
  "--select-highlight-color": p.accent,
  "--focus-highlight-color": p.accent,
  "--text-primary-color": p.text,
  "--icon-fill-color": p.text,
  "--color-selection": p.accent,
  "--color-primary": p.accent,
  "--color-primary-darker": p.accentEmphasis,
  "--color-primary-darkest": p.accentEmphasis,
  "--color-primary-hover": p.accentHover,
  "--color-primary-light": p.accentMuted,
  "--color-primary-light-darker": p.accentMuted,
  "--color-primary-contrast-offset": p.accent,
  "--color-brand-hover": p.accentHover,
  "--color-brand-active": p.accentEmphasis,
  "--color-promo": p.accent,
  "--color-logo-icon": p.accent,
  "--color-logo-text": p.text,
  "--color-surface-high": p.surfaceHover,
  "--color-surface-mid": p.surfaceAlt,
  "--color-surface-low": p.surfaceAlt,
  "--color-surface-lowest": p.canvas,
  "--color-on-surface": p.text,
  "--color-surface-primary-container": p.accentMuted,
  "--color-on-primary-container": isDark ? p.text : p.accentEmphasis,
  "--color-border-outline": p.textMuted,
  "--color-border-outline-variant": p.border,
  "--color-slider-track": p.accentMuted,
  "--color-slider-thumb": p.accent,
  "--color-danger": p.danger,
  "--scrollbar-thumb": p.borderMuted,
  "--scrollbar-thumb-hover": p.textMuted,
  "--avatar-border-color": p.border,
});

const BLACK_RED: Palette = {
  canvas: "#000000",
  surface: "#0d1117",
  surfaceAlt: "#010409",
  surfaceHover: "#1c2128",
  border: "#30363d",
  borderMuted: "#21262d",
  text: "#e6edf3",
  textMuted: "#7d8590",
  accent: "#da3633",
  accentHover: "#f85149",
  accentEmphasis: "#b62324",
  accentMuted: "#3c1618",
  accentOn: "#ffffff",
  danger: "#f85149",
  overlay: "rgba(1, 4, 9, 0.75)",
};

const GITHUB_DARK: Palette = {
  canvas: "#0d1117",
  surface: "#161b22",
  surfaceAlt: "#0d1117",
  surfaceHover: "#21262d",
  border: "#30363d",
  borderMuted: "#21262d",
  text: "#e6edf3",
  textMuted: "#7d8590",
  accent: "#2f81f7",
  accentHover: "#58a6ff",
  accentEmphasis: "#1f6feb",
  accentMuted: "#152a4a",
  accentOn: "#ffffff",
  danger: "#f85149",
  overlay: "rgba(1, 4, 9, 0.7)",
};

const MIDNIGHT: Palette = {
  canvas: "#0a0f1e",
  surface: "#10182b",
  surfaceAlt: "#0a0f1e",
  surfaceHover: "#1a2540",
  border: "#25324f",
  borderMuted: "#1a2540",
  text: "#dbe4ff",
  textMuted: "#8090b8",
  accent: "#5b8cff",
  accentHover: "#82a8ff",
  accentEmphasis: "#3f6fe6",
  accentMuted: "#1c2c55",
  accentOn: "#ffffff",
  danger: "#ff6b81",
  overlay: "rgba(5, 8, 18, 0.75)",
};

const HIGH_CONTRAST: Palette = {
  canvas: "#000000",
  surface: "#000000",
  surfaceAlt: "#000000",
  surfaceHover: "#2a2a2a",
  border: "#ffffff",
  borderMuted: "#9a9a9a",
  text: "#ffffff",
  textMuted: "#e0e0e0",
  accent: "#ffd60a",
  accentHover: "#ffe55c",
  accentEmphasis: "#ffd60a",
  accentMuted: "#4d4000",
  accentOn: "#000000",
  danger: "#ff5c5c",
  overlay: "rgba(0, 0, 0, 0.85)",
};

const GITHUB_LIGHT: Palette = {
  canvas: "#ffffff",
  surface: "#ffffff",
  surfaceAlt: "#f6f8fa",
  surfaceHover: "#eaeef2",
  border: "#d0d7de",
  borderMuted: "#d8dee4",
  text: "#1f2328",
  textMuted: "#656d76",
  accent: "#0969da",
  accentHover: "#0550ae",
  accentEmphasis: "#0550ae",
  accentMuted: "#ddf4ff",
  accentOn: "#ffffff",
  danger: "#cf222e",
  overlay: "rgba(31, 35, 40, 0.5)",
};

export const ZDRAW_THEMES: readonly ZDrawTheme[] = [
  {
    id: "black-red",
    label: "Black / Red",
    base: THEME.DARK,
    canvas: BLACK_RED.canvas,
    dense: true,
    swatch: [BLACK_RED.surface, BLACK_RED.accent],
    vars: paletteToVars(BLACK_RED, true),
  },
  {
    id: "github-dark",
    label: "GitHub dark",
    base: THEME.DARK,
    canvas: GITHUB_DARK.canvas,
    dense: true,
    swatch: [GITHUB_DARK.surface, GITHUB_DARK.accent],
    vars: paletteToVars(GITHUB_DARK, true),
  },
  {
    id: "midnight",
    label: "Midnight blue",
    base: THEME.DARK,
    canvas: MIDNIGHT.canvas,
    dense: true,
    swatch: [MIDNIGHT.surface, MIDNIGHT.accent],
    vars: paletteToVars(MIDNIGHT, true),
  },
  {
    id: "high-contrast",
    label: "High contrast",
    base: THEME.DARK,
    canvas: HIGH_CONTRAST.canvas,
    dense: true,
    swatch: [HIGH_CONTRAST.surface, HIGH_CONTRAST.accent],
    vars: {
      ...paletteToVars(HIGH_CONTRAST, true),
      "--zdraw-border-width": "2px",
    },
  },
  {
    id: "github-light",
    label: "GitHub light",
    base: THEME.LIGHT,
    canvas: null,
    dense: true,
    swatch: [GITHUB_LIGHT.surfaceAlt, GITHUB_LIGHT.accent],
    vars: paletteToVars(GITHUB_LIGHT, false),
  },
  {
    id: "classic-light",
    label: "Classic light",
    base: THEME.LIGHT,
    canvas: null,
    dense: false,
    swatch: ["#ffffff", "#6965db"],
    vars: {},
  },
];

export const DEFAULT_ZDRAW_THEME_ID: ZDrawThemeId = "black-red";
/** theme to fall back to when the base theme is toggled externally */
export const DEFAULT_THEME_FOR_BASE: Record<Theme, ZDrawThemeId> = {
  [THEME.DARK]: "black-red",
  [THEME.LIGHT]: "classic-light",
};

const STORAGE_KEY = "zdraw-theme";

export const getZDrawTheme = (id: string | null | undefined): ZDrawTheme =>
  ZDRAW_THEMES.find((theme) => theme.id === id) ||
  ZDRAW_THEMES.find((theme) => theme.id === DEFAULT_ZDRAW_THEME_ID)!;

export const loadZDrawThemeId = (): ZDrawThemeId => {
  try {
    return getZDrawTheme(localStorage.getItem(STORAGE_KEY)).id;
  } catch {
    return DEFAULT_ZDRAW_THEME_ID;
  }
};

export const saveZDrawThemeId = (id: ZDrawThemeId) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore (private mode / quota)
  }
};

/** scene `viewBackgroundColor` to use for a theme */
export const getThemeViewBackground = (theme: ZDrawTheme) =>
  theme.canvas ? "transparent" : "#ffffff";

/**
 * Whether a scene background is a "default" we may replace when switching
 * themes (we never clobber a user-picked custom canvas color).
 */
export const isReplaceableViewBackground = (color: string | undefined) =>
  !color ||
  color === "transparent" ||
  color.toLowerCase() === "#ffffff" ||
  color.toLowerCase() === "#fff";

const STYLE_ELEMENT_ID = "zdraw-theme-vars";

const buildThemeCSS = () =>
  ZDRAW_THEMES.filter((theme) => Object.keys(theme.vars).length)
    .map((theme) => {
      const body = Object.entries(theme.vars)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join("\n");
      // `html[...] .excalidraw` (0,2,1) beats `.excalidraw.theme--dark` (0,2,0)
      return `html[data-zdraw-theme="${theme.id}"] .excalidraw,\nhtml[data-zdraw-theme="${theme.id}"] .zdraw-themed {\n${body}\n}`;
    })
    .join("\n\n");

/** inject generated per-theme CSS variables + set the active theme on <html> */
export const applyZDrawThemeToDocument = (theme: ZDrawTheme) => {
  if (!document.getElementById(STYLE_ELEMENT_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = buildThemeCSS();
    document.head.appendChild(style);
  }
  const root = document.documentElement;
  root.dataset.zdrawTheme = theme.id;
  root.dataset.zdrawDense = theme.dense ? "true" : "false";
  root.style.setProperty("--zdraw-page-bg", theme.canvas || "");
  root.classList.toggle("dark", theme.base === THEME.DARK);
};
