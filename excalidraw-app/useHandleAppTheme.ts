import { THEME } from "@excalidraw/excalidraw";
import { useCallback, useLayoutEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { STORAGE_KEYS } from "./app_constants";
import { useBrandKit } from "./zdraw/brand";
import {
  DEFAULT_THEME_FOR_BASE,
  applyZDrawThemeToDocument,
  getZDrawTheme,
  loadZDrawThemeId,
  saveZDrawThemeId,
} from "./zdraw/themes";

import type { ZDrawThemeId } from "./zdraw/themes";

/**
 * zDraw: the app theme is a zDraw theme (see ./zdraw/themes.ts), each of which
 * maps onto one of Excalidraw's base themes (light/dark) for the editor.
 *
 * `appTheme` / `setAppTheme` keep the original Excalidraw signature so the
 * editor's own theme toggle (Alt+Shift+D, command palette) keeps working: when
 * the base theme is flipped externally we switch to that base's default zDraw
 * theme.
 */
export const useHandleAppTheme = () => {
  const [zdrawThemeId, setZDrawThemeIdState] = useState<ZDrawThemeId>(() =>
    loadZDrawThemeId(),
  );
  const [brand] = useBrandKit();
  // brand kit can lock the theme to the default Black / Red
  const zdrawTheme = getZDrawTheme(
    brand.lockTheme ? "black-red" : zdrawThemeId,
  );

  const setZDrawThemeId = useCallback((id: ZDrawThemeId) => {
    setZDrawThemeIdState(id);
  }, []);

  const setAppTheme = useCallback((theme: Theme | "system") => {
    const base: Theme =
      theme === "system"
        ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? THEME.DARK
          : THEME.LIGHT
        : theme;
    setZDrawThemeIdState((current) =>
      getZDrawTheme(current).base === base
        ? current
        : DEFAULT_THEME_FOR_BASE[base],
    );
  }, []);

  useLayoutEffect(() => {
    if (!brand.lockTheme) {
      saveZDrawThemeId(zdrawTheme.id);
    }
    // keep Excalidraw's own key in sync (read by index.html to avoid a flash)
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, zdrawTheme.base);
    applyZDrawThemeToDocument(zdrawTheme);
  }, [zdrawTheme, brand.lockTheme]);

  return {
    editorTheme: zdrawTheme.base,
    appTheme: zdrawTheme.base as Theme | "system",
    setAppTheme,
    zdrawTheme,
    setZDrawThemeId,
    themeLocked: brand.lockTheme,
  };
};
