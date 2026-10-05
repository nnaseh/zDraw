# zDraw desktop (macOS)

A thin [Tauri 2](https://tauri.app) window around the zDraw web build, with no Electron, no custom IPC and no plugins. The release `.app` is a few MB because it uses the system WebKit (WKWebView).

```
apps/zdraw-desktop/
  package.json              # only @tauri-apps/cli
  src-tauri/
    tauri.conf.json         # loads ../../../excalidraw-app/build (dev: localhost:3001)
    Cargo.toml, build.rs, src/main.rs
    icons/                  # generated with `tauri icon`
```

## Build on a Mac

Prerequisites, installed once:

```sh
xcode-select --install                                          # Apple toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  # Rust ≥ 1.90 (Tauri 2.12)
npm i -g yarn@1.22.22                                           # if yarn is missing
```

Build:

```sh
yarn install                          # repo root: web app deps
cd apps/zdraw-desktop && yarn install # Tauri CLI
yarn build                            # runs `yarn --cwd ../../excalidraw-app build`, then bundles
```

Output goes to `src-tauri/target/release/bundle/macos/zDraw.app` and `.../bundle/dmg/zDraw_0.1.0_*.dmg`. For a universal (Intel + Apple Silicon) binary, run `rustup target add x86_64-apple-darwin aarch64-apple-darwin` and then `yarn tauri build --target universal-apple-darwin`.

The app isn't signed. Gatekeeper will warn on first launch (right-click → Open), or you can set `bundle.macOS.signingIdentity` and notarize.

## Dev

```sh
yarn --cwd ../../excalidraw-app start   # vite on http://localhost:3001
yarn dev                                # Tauri window pointing at it
```

## Notes / limitations

- **Screen capture:** WKWebView doesn't expose `getDisplayMedia`, so Capture ▸ Screen / window shows a "not supported" error in the app. Use the web build in Safari or Chrome for that, or macOS ⌘⇧4 and paste.
- **Service worker:** the PWA service worker doesn't register under the `tauri://` scheme. That's harmless, because the assets are already local.
- **Firecrawl:** works as in the browser (it calls api.firecrawl.dev directly). Paste your key in the dialog.
- **Downloads (not yet verified):** exports use `<a download>`, which Tauri 2 should save to `~/Downloads`. If nothing appears, add a `.on_download` handler in `main.rs`.
