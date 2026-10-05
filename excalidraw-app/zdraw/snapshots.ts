import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { isInitializedImageElement } from "@excalidraw/element";
import { createStore, del, entries, set } from "idb-keyval";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

/**
 * zDraw local snapshots: named, timestamped copies of the scene kept in this
 * browser's IndexedDB. Nothing leaves the machine.
 */

export type Snapshot = {
  id: string;
  name: string;
  createdAt: number;
  elementCount: number;
  elements: readonly OrderedExcalidrawElement[];
  viewBackgroundColor: string;
  files: BinaryFileData[];
};

const store = createStore("zdraw-snapshots-db", "snapshots");

export const listSnapshots = async (): Promise<Snapshot[]> => {
  const all = await entries<string, Snapshot>(store);
  return all.map(([, s]) => s).sort((a, b) => b.createdAt - a.createdAt);
};

export const saveSnapshot = async (
  api: ExcalidrawImperativeAPI,
  name?: string,
): Promise<Snapshot> => {
  const elements = api.getSceneElements();
  const allFiles = api.getFiles();
  const fileIds = new Set(
    elements.filter(isInitializedImageElement).map((el) => el.fileId),
  );
  const createdAt = Date.now();
  const snapshot: Snapshot = {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    name:
      name?.trim() ||
      `${api.getName() || "Untitled"} · ${new Date(
        createdAt,
      ).toLocaleString()}`,
    createdAt,
    elementCount: elements.length,
    elements,
    viewBackgroundColor: api.getAppState().viewBackgroundColor,
    files: [...fileIds].map((id) => allFiles[id]).filter(Boolean),
  };
  await set(snapshot.id, snapshot, store);
  return snapshot;
};

export const deleteSnapshot = (id: string) => del(id, store);

/** replaces the scene with a snapshot (undoable with Ctrl+Z) */
export const restoreSnapshot = (
  api: ExcalidrawImperativeAPI,
  snapshot: Snapshot,
) => {
  if (snapshot.files.length) {
    api.addFiles(snapshot.files);
  }
  const keep = new Set(snapshot.elements.map((el) => el.id));
  // mark current elements not in the snapshot as deleted so the change is a
  // single undoable step instead of a hard reset
  const current = api
    .getSceneElementsIncludingDeleted()
    .filter((el) => !keep.has(el.id))
    .map((el) => ({ ...el, isDeleted: true, version: el.version + 1 }));
  api.updateScene({
    elements: [
      ...snapshot.elements.map((el) => ({
        ...el,
        version: el.version + 1,
        versionNonce: Math.floor(Math.random() * 2 ** 31),
      })),
      ...current,
    ],
    appState: { viewBackgroundColor: snapshot.viewBackgroundColor },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  if (snapshot.elements.some((el) => !el.isDeleted)) {
    api.setViewport({
      target: api.getSceneElements(),
      fit: "scale-down",
      animation: true,
    });
  }
};
