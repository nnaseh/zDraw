import { eyeIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import { LanguageList } from "../app-language/LanguageList";
import {
  BrandIcon,
  CameraIcon,
  ExportPresetIcon,
  KeyboardIcon,
  SnapshotIcon,
} from "../zdraw/icons";
import { ThemePicker } from "../zdraw/ThemePicker";

import { saveDebugState } from "./DebugCanvas";

import type { ZDrawDialog } from "../zdraw/state";
import type { ZDrawThemeId } from "../zdraw/themes";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  zdrawThemeId: ZDrawThemeId;
  onZDrawThemeChange: (id: ZDrawThemeId) => void;
  onOpenZDrawDialog: (dialog: NonNullable<ZDrawDialog>) => void;
  refresh: () => void;
}> = React.memo((props) => {
  useI18n();
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.Item
        icon={ExportPresetIcon}
        onSelect={() => props.onOpenZDrawDialog({ type: "export-presets" })}
      >
        Export presets…
      </MainMenu.Item>
      <MainMenu.Item
        icon={CameraIcon}
        shortcut="Alt+Shift+X"
        onSelect={() =>
          props.onOpenZDrawDialog({ type: "image-editor", source: "selection" })
        }
      >
        Capture & annotate…
      </MainMenu.Item>
      <MainMenu.Item
        icon={SnapshotIcon}
        onSelect={() => props.onOpenZDrawDialog({ type: "snapshots" })}
      >
        Local snapshots…
      </MainMenu.Item>
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.Item
        icon={KeyboardIcon}
        shortcut="Alt+Shift+K"
        onSelect={() => props.onOpenZDrawDialog({ type: "cheatsheet" })}
      >
        zDraw shortcuts
      </MainMenu.Item>
      <MainMenu.DefaultItems.ClearCanvas />
      {isDevEnv() && <MainMenu.Separator />}
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.Item
        icon={BrandIcon}
        onSelect={() => props.onOpenZDrawDialog({ type: "brand-kit" })}
      >
        Brand kit…
      </MainMenu.Item>
      <MainMenu.ItemCustom>
        <ThemePicker
          value={props.zdrawThemeId}
          onChange={props.onZDrawThemeChange}
        />
      </MainMenu.ItemCustom>
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
