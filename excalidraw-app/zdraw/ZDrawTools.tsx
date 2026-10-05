import { DEFAULT_CATEGORIES } from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { CommandPaletteItem } from "@excalidraw/excalidraw/components/CommandPalette/types";

import { useAtom, useSetAtom } from "../app-jotai";

import { BrandKitDialog } from "./brand";

import { EXPORT_PRESETS, runExportPreset } from "./exportPresets";
import { FirecrawlDialog } from "./firecrawl";
import {
  BrandIcon,
  CameraIcon,
  ChevronDownIcon,
  ExportPresetIcon,
  GlobeIcon,
  KeyboardIcon,
  SnapshotIcon,
} from "./icons";
import { ImageEditorDialog } from "./imageTools/ImageEditorDialog";
import { capture, getSingleSelectedImage } from "./imageTools/sceneIO";
import {
  deleteSnapshot,
  listSnapshots,
  restoreSnapshot,
  saveSnapshot,
} from "./snapshots";
import { zdrawCaptureMenuOpenAtom, zdrawDialogAtom } from "./state";
import { ZDRAW_THEMES } from "./themes";

import type { CaptureSource } from "./imageTools/sceneIO";
import type { Snapshot } from "./snapshots";
import type { ZDrawTheme, ZDrawThemeId } from "./themes";
import type { ToolId } from "./imageTools/annotations";

const CAPTURE_OPTIONS: {
  source: CaptureSource;
  label: string;
  hint: string;
}[] = [
  {
    source: "selection",
    label: "Selection / image",
    hint: "Edit the selected image, or capture selected elements",
  },
  { source: "region", label: "Region…", hint: "Capture the view, then crop" },
  { source: "viewport", label: "Visible area", hint: "What's on screen now" },
  { source: "scene", label: "Whole drawing", hint: "All elements, 2×" },
  {
    source: "screen",
    label: "Screen / window…",
    hint: "Pick a screen, window or tab (Alt+Shift+S)",
  },
];

const showError = (api: ExcalidrawImperativeAPI, error: unknown) => {
  api.updateScene({
    appState: {
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  });
};

// ---------------------------------------------------------------------------
// top-right toolbar
// ---------------------------------------------------------------------------

const useClickOutside = (
  ref: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled: boolean,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [ref, onOutside, enabled]);
};

export const ZDrawToolbar = ({ children }: { children?: React.ReactNode }) => {
  const setDialog = useSetAtom(zdrawDialogAtom);
  const [menuOpen, setMenuOpen] = useAtom(zdrawCaptureMenuOpenAtom);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), [setMenuOpen]);
  useClickOutside(menuRef, closeMenu, menuOpen);

  return (
    <div className="zdraw-toolbar" data-testid="zdraw-toolbar">
      <div className="zdraw-menu" ref={menuRef}>
        <button
          type="button"
          className="zdraw-toolbar__primary"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Capture & annotate (Alt+Shift+X)"
          data-testid="zdraw-capture-button"
        >
          {CameraIcon}
          Capture
          {ChevronDownIcon}
        </button>
        {menuOpen && (
          <div className="zdraw-menu__list" role="menu">
            {CAPTURE_OPTIONS.map((option) => (
              <button
                key={option.source}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setDialog({ type: "image-editor", source: option.source });
                }}
              >
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setDialog({ type: "firecrawl" });
              }}
            >
              <span>Web page (Firecrawl)…</span>
              <small>Screenshot + markdown of a URL</small>
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        title="Export presets"
        onClick={() => setDialog({ type: "export-presets" })}
        data-testid="zdraw-export-button"
      >
        {ExportPresetIcon}
        Export
      </button>
      <button
        type="button"
        title="Local snapshots (Alt+Shift+N saves one)"
        onClick={() => setDialog({ type: "snapshots" })}
        data-testid="zdraw-snapshots-button"
      >
        {SnapshotIcon}
        Snapshots
      </button>
      <button
        type="button"
        title="zDraw shortcuts (Alt+Shift+K)"
        aria-label="zDraw shortcuts"
        onClick={() => setDialog({ type: "cheatsheet" })}
      >
        {KeyboardIcon}
      </button>
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// dialogs
// ---------------------------------------------------------------------------

const CaptureFlow = ({
  api,
  theme,
  source,
  onClose,
}: {
  api: ExcalidrawImperativeAPI;
  theme: ZDrawTheme;
  source: CaptureSource;
  onClose: () => void;
}) => {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof capture>
  > | null>(null);
  const [meta] = useState(() => {
    const image = source === "selection" && getSingleSelectedImage(api);
    const hasSelection =
      Object.keys(api.getAppState().selectedElementIds).length > 0;
    const effective: CaptureSource =
      source === "selection" && !hasSelection ? "region" : source;
    return {
      effective,
      initialTool: (effective === "region" || effective === "screen"
        ? "crop"
        : "arrow") as ToolId,
      pixelRatio: image
        ? 1
        : effective === "viewport" ||
          effective === "region" ||
          effective === "screen"
        ? window.devicePixelRatio || 1
        : 2,
      title: image
        ? "Edit image"
        : effective === "region"
        ? "Capture region — drag to crop"
        : effective === "viewport"
        ? "Capture visible area"
        : effective === "scene"
        ? "Capture whole drawing"
        : effective === "screen"
        ? "Screen capture"
        : "Capture selection",
    };
  });

  useEffect(() => {
    let cancelled = false;
    capture(api, theme, meta.effective)
      .then((res) => !cancelled && setResult(res))
      .catch((error) => {
        if (!cancelled) {
          showError(api, error);
          onClose();
        }
      });
    return () => {
      cancelled = true;
    };
    // capture once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) {
    return null;
  }
  return (
    <ImageEditorDialog
      excalidrawAPI={api}
      source={result.canvas}
      replaceTarget={result.replaceTarget}
      initialTool={meta.initialTool}
      title={meta.title}
      pixelRatio={meta.pixelRatio}
      defaultColor={theme.vars["--zdraw-accent"] || "#da3633"}
      onClose={onClose}
    />
  );
};

const ExportPresetsDialog = ({
  api,
  theme,
  onClose,
}: {
  api: ExcalidrawImperativeAPI;
  theme: ZDrawTheme;
  onClose: () => void;
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const hasSelection =
    Object.keys(api.getAppState().selectedElementIds).length > 0;
  return (
    <Dialog onCloseRequest={onClose} title="Export presets" size="small">
      <div className="zdraw-list">
        <p className="zdraw-list__hint">
          Exports {hasSelection ? "the current selection" : "the whole drawing"}
          . For more options use the standard export dialog (Ctrl+Shift+E).
        </p>
        {EXPORT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="zdraw-list__item"
            disabled={!!busy}
            data-testid={`zdraw-export-${preset.id}`}
            onClick={async () => {
              setBusy(preset.id);
              try {
                const message = await runExportPreset(api, theme, preset.id);
                api.setToast({ message: message || "Done", duration: 2500 });
                onClose();
              } catch (error) {
                showError(api, error);
              } finally {
                setBusy(null);
              }
            }}
          >
            <span>{busy === preset.id ? "Exporting…" : preset.label}</span>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>
    </Dialog>
  );
};

const SnapshotsDialog = ({
  api,
  onClose,
}: {
  api: ExcalidrawImperativeAPI;
  onClose: () => void;
}) => {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [name, setName] = useState("");
  const refresh = useCallback(
    () =>
      listSnapshots()
        .then(setSnapshots)
        .catch((error) => showError(api, error)),
    [api],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Dialog onCloseRequest={onClose} title="Local snapshots" size="regular">
      <div className="zdraw-list">
        <p className="zdraw-list__hint">
          Snapshots are stored only in this browser (IndexedDB). Restoring is
          undoable with Ctrl+Z.
        </p>
        <form
          className="zdraw-list__form"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await saveSnapshot(api, name);
              setName("");
              refresh();
            } catch (error) {
              showError(api, error);
            }
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Snapshot name (optional)"
            onKeyDown={(e) => e.key !== "Escape" && e.stopPropagation()}
          />
          <button type="submit" className="zdraw-btn zdraw-btn--primary">
            Save snapshot
          </button>
        </form>
        {snapshots === null ? (
          <p className="zdraw-list__hint">Loading…</p>
        ) : snapshots.length === 0 ? (
          <p className="zdraw-list__hint">No snapshots yet.</p>
        ) : (
          snapshots.map((snapshot) => (
            <div key={snapshot.id} className="zdraw-list__row">
              <div>
                <span>{snapshot.name}</span>
                <small>
                  {new Date(snapshot.createdAt).toLocaleString()} ·{" "}
                  {snapshot.elementCount} elements
                  {snapshot.files.length
                    ? ` · ${snapshot.files.length} images`
                    : ""}
                </small>
              </div>
              <button
                type="button"
                className="zdraw-btn"
                onClick={() => {
                  restoreSnapshot(api, snapshot);
                  api.setToast({
                    message: "Snapshot restored",
                    duration: 2500,
                  });
                  onClose();
                }}
              >
                Restore
              </button>
              <button
                type="button"
                className="zdraw-btn zdraw-btn--danger"
                aria-label={`Delete ${snapshot.name}`}
                onClick={async () => {
                  await deleteSnapshot(snapshot.id);
                  refresh();
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
};

const SHORTCUTS: { group: string; items: [string, string][] }[] = [
  {
    group: "zDraw",
    items: [
      ["Alt+Shift+X", "Capture & annotate (selection, else region)"],
      ["Alt+Shift+S", "Capture screen / window / tab"],
      ["Alt+Shift+T", "Next theme"],
      ["Alt+Shift+N", "Save local snapshot"],
      ["Alt+Shift+K", "This cheat sheet"],
      ["Alt+Shift+D", "Toggle light / dark"],
    ],
  },
  {
    group: "Image tools",
    items: [
      ["A / R / C / N", "Arrow / Box / Callout / Step"],
      ["B / X", "Blur (pixelate) / Redact"],
      ["S / M / K", "Spotlight / Magnify / Crop"],
      ["Enter", "Apply crop"],
      ["Ctrl+Z / Ctrl+Shift+Z", "Undo / Redo"],
    ],
  },
  {
    group: "Editor essentials",
    items: [
      ["V / H", "Select / Hand (pan)"],
      ["R / D / O / A / L", "Rectangle / Diamond / Ellipse / Arrow / Line"],
      ["P / T / E / I", "Draw / Text / Eraser / Insert image"],
      ["Ctrl+/ or Ctrl+Shift+P", "Command palette"],
      ["Ctrl+S / Ctrl+O", "Save to file / Open file"],
      ["Ctrl+Shift+E", "Export image dialog"],
      ["?", "All editor shortcuts"],
    ],
  },
];

const CheatSheetDialog = ({ onClose }: { onClose: () => void }) => (
  <Dialog onCloseRequest={onClose} title="zDraw shortcuts" size="regular">
    <div className="zdraw-cheatsheet">
      {SHORTCUTS.map((section) => (
        <section key={section.group}>
          <h4>{section.group}</h4>
          <dl>
            {section.items.map(([keys, label]) => (
              <React.Fragment key={keys}>
                <dt>
                  {keys.split(" / ").map((k, i) => (
                    <React.Fragment key={k}>
                      {i > 0 && " / "}
                      <kbd>{k}</kbd>
                    </React.Fragment>
                  ))}
                </dt>
                <dd>{label}</dd>
              </React.Fragment>
            ))}
          </dl>
        </section>
      ))}
    </div>
  </Dialog>
);

export const ZDrawDialogs = ({
  api,
  theme,
}: {
  api: ExcalidrawImperativeAPI;
  theme: ZDrawTheme;
}) => {
  const [dialog, setDialog] = useAtom(zdrawDialogAtom);
  const close = useCallback(() => setDialog(null), [setDialog]);
  if (!dialog) {
    return null;
  }
  switch (dialog.type) {
    case "image-editor":
      return (
        <CaptureFlow
          api={api}
          theme={theme}
          source={dialog.source}
          onClose={close}
        />
      );
    case "export-presets":
      return <ExportPresetsDialog api={api} theme={theme} onClose={close} />;
    case "snapshots":
      return <SnapshotsDialog api={api} onClose={close} />;
    case "cheatsheet":
      return <CheatSheetDialog onClose={close} />;
    case "firecrawl":
      return <FirecrawlDialog api={api} onClose={close} />;
    case "brand-kit":
      return <BrandKitDialog onClose={close} />;
  }
};

// ---------------------------------------------------------------------------
// global shortcuts + command palette
// ---------------------------------------------------------------------------

export const useZDrawShortcuts = ({
  api,
  themeId,
  setThemeId,
  themeLocked,
}: {
  api: ExcalidrawImperativeAPI | null;
  themeId: ZDrawThemeId;
  setThemeId: (id: ZDrawThemeId) => void;
  themeLocked: boolean;
}) => {
  const setDialog = useSetAtom(zdrawDialogAtom);
  useEffect(() => {
    if (!api) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, [contenteditable=true]")) {
        return;
      }
      let handled = true;
      switch (event.code) {
        case "KeyX":
          setDialog({ type: "image-editor", source: "selection" });
          break;
        case "KeyS":
          setDialog({ type: "image-editor", source: "screen" });
          break;
        case "KeyT": {
          if (themeLocked) {
            api.setToast({ message: "Theme locked by Brand kit" });
            break;
          }
          const index = ZDRAW_THEMES.findIndex((t) => t.id === themeId);
          const next = ZDRAW_THEMES[(index + 1) % ZDRAW_THEMES.length];
          setThemeId(next.id);
          api.setToast({ message: `Theme: ${next.label}`, duration: 1500 });
          break;
        }
        case "KeyN":
          saveSnapshot(api)
            .then((s) =>
              api.setToast({ message: `Saved “${s.name}”`, duration: 2500 }),
            )
            .catch((error) => showError(api, error));
          break;
        case "KeyK":
          setDialog({ type: "cheatsheet" });
          break;
        default:
          handled = false;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    // capture phase: runs before the editor's own document-level handler
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [api, themeId, setThemeId, themeLocked, setDialog]);
};

export const getZDrawCommands = ({
  openDialog,
  themeId,
  setThemeId,
  themeLocked,
}: {
  openDialog: (dialog: NonNullable<import("./state").ZDrawDialog>) => void;
  themeId: ZDrawThemeId;
  setThemeId: (id: ZDrawThemeId) => void;
  themeLocked: boolean;
}): CommandPaletteItem[] => [
  ...CAPTURE_OPTIONS.map(
    (option): CommandPaletteItem => ({
      label: `Capture: ${option.label.replace("…", "")}`,
      category: DEFAULT_CATEGORIES.export,
      icon: CameraIcon,
      keywords: ["snagit", "screenshot", "annotate", "image", "capture"],
      perform: () =>
        openDialog({ type: "image-editor", source: option.source }),
    }),
  ),
  {
    label: "Web page (Firecrawl)…",
    category: DEFAULT_CATEGORIES.export,
    icon: GlobeIcon,
    keywords: [
      "firecrawl",
      "scrape",
      "url",
      "website",
      "screenshot",
      "markdown",
    ],
    perform: () => openDialog({ type: "firecrawl" }),
  },
  {
    label: "Brand kit…",
    category: DEFAULT_CATEGORIES.app,
    icon: BrandIcon,
    keywords: ["brand", "logo", "accent", "color", "lock theme"],
    perform: () => openDialog({ type: "brand-kit" }),
  },
  {
    label: "Export presets…",
    category: DEFAULT_CATEGORIES.export,
    icon: ExportPresetIcon,
    keywords: ["png", "svg", "pdf", "slide", "transparent", "export"],
    perform: () => openDialog({ type: "export-presets" }),
  },
  {
    label: "Local snapshots…",
    category: DEFAULT_CATEGORIES.app,
    icon: SnapshotIcon,
    keywords: ["save", "version", "history", "backup", "restore"],
    perform: () => openDialog({ type: "snapshots" }),
  },
  {
    label: "zDraw shortcuts",
    category: DEFAULT_CATEGORIES.app,
    icon: KeyboardIcon,
    keywords: ["keyboard", "cheat sheet", "help", "hotkeys"],
    perform: () => openDialog({ type: "cheatsheet" }),
  },
  ...ZDRAW_THEMES.map(
    (theme): CommandPaletteItem => ({
      label: `Theme: ${theme.label}`,
      category: DEFAULT_CATEGORIES.app,
      keywords: ["theme", "color", "dark", "light", "appearance"],
      predicate: () => !themeLocked && theme.id !== themeId,
      perform: () => setThemeId(theme.id),
    }),
  ),
];
