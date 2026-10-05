import { ExcalidrawLogo } from "@excalidraw/excalidraw/components/ExcalidrawLogo";
import React from "react";

import { useAtomValue } from "../app-jotai";
import { brandKitAtom } from "../zdraw/brand";

import "./ZDrawLogo.scss";

/**
 * zDraw wordmark used on the app welcome screen (replaces the built-in
 * Excalidraw SVG wordmark). Reuses the library's logo icon and renders the
 * product name as text in the hand-drawn Excalifont.
 */
export const ZDrawLogo = () => {
  const { logo } = useAtomValue(brandKitAtom);
  if (logo) {
    return (
      <div className="ZDrawLogo">
        <img className="ZDrawLogo-custom" src={logo} alt="Logo" />
      </div>
    );
  }
  return (
    <div className="ZDrawLogo">
      <ExcalidrawLogo size="small" />
      <span className="ZDrawLogo-text excalifont">zDraw</span>
    </div>
  );
};
