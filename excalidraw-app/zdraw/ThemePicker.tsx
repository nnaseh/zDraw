import React from "react";

import { useAtomValue } from "../app-jotai";

import { brandKitAtom } from "./brand";

import { ZDRAW_THEMES } from "./themes";

import type { ZDrawThemeId } from "./themes";

export const ThemePicker = ({
  value,
  onChange,
}: {
  value: ZDrawThemeId;
  onChange: (id: ZDrawThemeId) => void;
}) => {
  const { lockTheme } = useAtomValue(brandKitAtom);
  return (
    <div className="zdraw-theme-picker" role="radiogroup" aria-label="Theme">
      <div className="zdraw-theme-picker__title">
        Theme{lockTheme && " · locked by Brand kit"}
      </div>
      <div className="zdraw-theme-picker__grid">
        {ZDRAW_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={theme.id === value}
            disabled={lockTheme}
            title={theme.label}
            data-testid={`zdraw-theme-${theme.id}`}
            onClick={(event) => {
              // keep the main menu open while browsing themes
              event.stopPropagation();
              onChange(theme.id);
            }}
          >
            <span
              className="zdraw-theme-picker__swatch"
              style={{
                background: `linear-gradient(135deg, ${theme.swatch[0]} 50%, ${theme.swatch[1]} 50%)`,
              }}
            />
            {theme.label}
          </button>
        ))}
      </div>
    </div>
  );
};
