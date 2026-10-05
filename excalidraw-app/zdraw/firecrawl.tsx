import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import { FONT_FAMILY } from "@excalidraw/common";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { imageToCanvas, insertImage, loadImage } from "./imageTools/sceneIO";

/**
 * Firecrawl (https://firecrawl.dev) web capture: scrape a URL for a
 * screenshot and/or markdown and drop them on the canvas. Thin fetch wrapper
 * around POST /v2/scrape — no SDK. The key lives in localStorage only
 * (FIRECRAWL_KEY_STORAGE), with VITE_APP_FIRECRAWL_API_KEY as a build-time
 * default.
 */
export const FIRECRAWL_KEY_STORAGE = "zdraw-firecrawl-api-key";
const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const MAX_TEXT = 8000;

type ScrapeData = {
  markdown?: string;
  screenshot?: string;
  metadata?: { title?: string | string[]; sourceURL?: string };
};

export const firecrawlScrape = async (
  url: string,
  apiKey: string,
  opts: { markdown: boolean; screenshot: boolean; fullPage: boolean },
): Promise<ScrapeData> => {
  if (!apiKey) {
    throw new Error(
      "No Firecrawl API key. Paste one from firecrawl.dev (stored only in this browser) or build with VITE_APP_FIRECRAWL_API_KEY.",
    );
  }
  const formats: unknown[] = [];
  if (opts.markdown) {
    formats.push("markdown");
  }
  if (opts.screenshot) {
    formats.push({ type: "screenshot", fullPage: opts.fullPage });
  }
  const res = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(
      `Firecrawl: ${json?.error || `${res.status} ${res.statusText}`}`,
    );
  }
  return json.data;
};

/** naive word wrap so long markdown lines don't become one huge text line */
const wrap = (text: string, width = 100) =>
  text
    .split("\n")
    .map((line) => {
      const out: string[] = [];
      let current = "";
      for (const word of line.split(" ")) {
        if (current && current.length + word.length + 1 > width) {
          out.push(current);
          current = word;
        } else {
          current = current ? `${current} ${word}` : word;
        }
      }
      return [...out, current].join("\n");
    })
    .join("\n");

const insertText = (
  api: ExcalidrawImperativeAPI,
  text: string,
  x: number,
  y: number,
) => {
  const [element] = convertToExcalidrawElements([
    { type: "text", text, x, y, fontSize: 16, fontFamily: FONT_FAMILY.Nunito },
  ]);
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), element],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

const insertScrape = async (
  api: ExcalidrawImperativeAPI,
  url: string,
  data: ScrapeData,
) => {
  const warnings: string[] = [];
  let image: { x: number; y: number; width: number } | null = null;
  if (data.screenshot) {
    try {
      const blob = await (await fetch(data.screenshot)).blob();
      const objectURL = URL.createObjectURL(blob);
      const img = await loadImage(objectURL).finally(() =>
        URL.revokeObjectURL(objectURL),
      );
      image = insertImage(
        api,
        imageToCanvas(img, img.naturalWidth, img.naturalHeight),
      );
    } catch {
      warnings.push("screenshot couldn't be downloaded (link added instead)");
      data.markdown = `Screenshot: ${data.screenshot}\n\n${
        data.markdown || ""
      }`;
    }
  }
  if (data.markdown) {
    const title = [data.metadata?.title].flat()[0];
    let text = `${title ? `# ${title}\n` : ""}Source: ${url}\n\n${
      data.markdown
    }`;
    if (text.length > MAX_TEXT) {
      text = `${text.slice(0, MAX_TEXT)}\n\n… (truncated)`;
    }
    const { scrollX, scrollY, width, height, zoom } = api.getAppState();
    const x = image
      ? image.x + image.width + 40
      : -scrollX + width / zoom.value / 2 - 300;
    const y = image ? image.y : -scrollY + height / zoom.value / 4;
    insertText(api, wrap(text), x, y);
  }
  return warnings;
};

export const FirecrawlDialog = ({
  api,
  onClose,
}: {
  api: ExcalidrawImperativeAPI;
  onClose: () => void;
}) => {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState(
    () =>
      localStorage.getItem(FIRECRAWL_KEY_STORAGE) ||
      import.meta.env.VITE_APP_FIRECRAWL_API_KEY ||
      "",
  );
  const [opts, setOpts] = useState({
    screenshot: true,
    markdown: true,
    fullPage: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const target = /^https?:\/\//i.test(url.trim())
      ? url.trim()
      : `https://${url.trim()}`;
    if (apiKey) {
      localStorage.setItem(FIRECRAWL_KEY_STORAGE, apiKey);
    }
    setBusy(true);
    try {
      const data = await firecrawlScrape(target, apiKey, opts);
      const warnings = await insertScrape(api, target, data);
      api.setToast({
        message: `Inserted ${target}${
          warnings.length ? ` — ${warnings.join("; ")}` : ""
        }`,
        duration: 4000,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const check = (key: keyof typeof opts, label: string) => (
    <label className="zdraw-check">
      <input
        type="checkbox"
        checked={opts[key]}
        onChange={(e) => setOpts({ ...opts, [key]: e.target.checked })}
      />
      {label}
    </label>
  );

  return (
    <Dialog onCloseRequest={onClose} title="Web page (Firecrawl)" size="small">
      <form
        className="zdraw-list zdraw-form"
        onSubmit={submit}
        onKeyDown={(e) => e.key !== "Escape" && e.stopPropagation()}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          autoFocus
          data-testid="zdraw-firecrawl-url"
        />
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Firecrawl API key (fc-…)"
          autoComplete="off"
          data-testid="zdraw-firecrawl-key"
        />
        <div className="zdraw-form__row">
          {check("screenshot", "Screenshot")}
          {check("fullPage", "Full page")}
          {check("markdown", "Markdown text")}
        </div>
        {error && <p className="zdraw-form__error">{error}</p>}
        <div className="zdraw-form__row">
          <button
            type="submit"
            className="zdraw-btn zdraw-btn--primary"
            disabled={busy || (!opts.screenshot && !opts.markdown)}
          >
            {busy ? "Scraping…" : "Scrape & insert"}
          </button>
          {localStorage.getItem(FIRECRAWL_KEY_STORAGE) && (
            <button
              type="button"
              className="zdraw-btn"
              onClick={() => {
                localStorage.removeItem(FIRECRAWL_KEY_STORAGE);
                setApiKey("");
              }}
            >
              Forget key
            </button>
          )}
        </div>
        <p className="zdraw-list__hint">
          Sends the URL to api.firecrawl.dev using your key. The key is stored
          only in this browser (localStorage “{FIRECRAWL_KEY_STORAGE}”).
        </p>
      </form>
    </Dialog>
  );
};
