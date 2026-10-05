import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React, { useLayoutEffect } from "react";

import { atom, useAtom } from "../app-jotai";

import { imageToCanvas, loadImage } from "./imageTools/sceneIO";

/**
 * Brand kit: custom welcome-screen logo, optional accent color and a theme
 * lock (Black / Red). Stored in this browser only (localStorage "zdraw-brand").
 */
export type BrandKit = {
  logo: string | null; // PNG data URL
  accent: string | null; // #rrggbb
  lockTheme: boolean;
};

const STORAGE_KEY = "zdraw-brand";
const DEFAULT_BRAND: BrandKit = { logo: null, accent: null, lockTheme: false };

const loadBrandKit = (): BrandKit => {
  try {
    return {
      ...DEFAULT_BRAND,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    };
  } catch {
    return DEFAULT_BRAND;
  }
};

export const brandKitAtom = atom<BrandKit>(loadBrandKit());

const ACCENT_STYLE_ID = "zdraw-brand-accent";

const accentCSS = (accent: string) => {
  const hover = `color-mix(in srgb, ${accent} 80%, white)`;
  const emphasis = `color-mix(in srgb, ${accent} 80%, black)`;
  const muted = `color-mix(in srgb, ${accent} 25%, var(--zdraw-canvas, var(--island-bg-color)))`;
  const vars: Record<string, string> = {
    "--zdraw-accent": accent,
    "--button-active-border": accent,
    "--link-color": accent,
    "--select-highlight-color": accent,
    "--focus-highlight-color": accent,
    "--color-selection": accent,
    "--color-primary": accent,
    "--color-primary-contrast-offset": accent,
    "--color-promo": accent,
    "--color-logo-icon": accent,
    "--color-slider-thumb": accent,
    "--link-color-hover": hover,
    "--color-primary-hover": hover,
    "--color-brand-hover": hover,
    "--color-primary-darker": emphasis,
    "--color-primary-darkest": emphasis,
    "--color-brand-active": emphasis,
    "--color-primary-light": muted,
    "--color-primary-light-darker": muted,
    "--color-surface-primary-container": muted,
    "--color-slider-track": muted,
  };
  // (0,2,2) beats the theme rules' `html[data-zdraw-theme=x] .excalidraw`
  return `html[data-zdraw-theme] body .excalidraw, html[data-zdraw-theme] body .zdraw-themed {\n${Object.entries(
    vars,
  )
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n")}\n}`;
};

/** brand kit state + side effects (accent CSS); call once at the app root */
export const useBrandKit = () => {
  const [brand, setBrand] = useAtom(brandKitAtom);
  useLayoutEffect(() => {
    document.getElementById(ACCENT_STYLE_ID)?.remove();
    if (brand.accent) {
      const style = document.createElement("style");
      style.id = ACCENT_STYLE_ID;
      style.textContent = accentCSS(brand.accent);
      document.head.appendChild(style);
    }
  }, [brand.accent]);
  return [brand, setBrand] as const;
};

/** downscale an uploaded logo to ≤512px PNG so it fits in localStorage */
const fileToLogo = async (file: File) => {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(
      1,
      512 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    return imageToCanvas(
      img,
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    ).toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const BrandKitDialog = ({ onClose }: { onClose: () => void }) => {
  const [brand, setBrand] = useAtom(brandKitAtom);
  const [error, setError] = React.useState<string | null>(null);

  const update = (patch: Partial<BrandKit>) => {
    const next = { ...brand, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setBrand(next);
      setError(null);
    } catch {
      setError("Couldn't save — browser storage is full. Try a smaller logo.");
    }
  };

  return (
    <Dialog onCloseRequest={onClose} title="Brand kit" size="small">
      <div className="zdraw-list zdraw-form">
        <h4>Logo</h4>
        <div className="zdraw-form__row">
          {brand.logo && (
            <img className="zdraw-brand__logo" src={brand.logo} alt="Logo" />
          )}
          <label className="zdraw-btn">
            {brand.logo ? "Replace…" : "Upload…"}
            <input
              type="file"
              accept="image/*"
              hidden
              data-testid="zdraw-brand-logo-input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  update({ logo: await fileToLogo(file) });
                }
              }}
            />
          </label>
          {brand.logo && (
            <button
              type="button"
              className="zdraw-btn"
              onClick={() => update({ logo: null })}
            >
              Remove
            </button>
          )}
        </div>

        <h4>Accent color</h4>
        <div className="zdraw-form__row">
          <input
            type="color"
            value={brand.accent || "#da3633"}
            onChange={(e) => update({ accent: e.target.value })}
            data-testid="zdraw-brand-accent"
          />
          <code>{brand.accent || "theme default"}</code>
          {brand.accent && (
            <button
              type="button"
              className="zdraw-btn"
              onClick={() => update({ accent: null })}
            >
              Reset
            </button>
          )}
        </div>

        <label className="zdraw-check">
          <input
            type="checkbox"
            checked={brand.lockTheme}
            onChange={(e) => update({ lockTheme: e.target.checked })}
            data-testid="zdraw-brand-lock"
          />
          Lock theme to Black / Red
        </label>

        {error && <p className="zdraw-form__error">{error}</p>}
        <p className="zdraw-list__hint">
          Stored only in this browser (localStorage “{STORAGE_KEY}”).
        </p>
      </div>
    </Dialog>
  );
};
