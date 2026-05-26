# Kubeseal Activity Bar Panel

**Date:** 2026-05-26  
**Status:** Approved

## Overview

Add a Kubeseal entry to the VS Code activity bar with a sidebar panel containing three tabs: Base64, Settings, and Actions. Replaces the need to use the command palette or context menus for common operations.

## Architecture

One `WebviewViewProvider` (`src/ui/panelProvider.ts`) registered as a `viewsContainers` activity bar entry. Single persistent webview, 3 tabs rendered in HTML/JS. Tabs communicate with the extension host via `postMessage` / `onDidReceiveMessage`.

No external bundler or new npm dependencies. Webview HTML/JS/CSS is embedded as a template string inside `panelProvider.ts`. Styling uses VS Code CSS variables (`--vscode-*`) for full theme compatibility.

### New files

- `src/ui/panelProvider.ts` — `WebviewViewProvider` implementation, message router
- `assets/panel-icon.svg` — activity bar icon (monochrome SVG, ~16×16)

### Modified files

- `src/extension.ts` — register the provider and `viewsContainers` / `views` contribution
- `package.json` — add `viewsContainers`, `views` contribution points

## Tab: Base64

- Textarea for freeform text input (paste any value)
- Encode / Decode buttons send `{ command: 'encode'|'decode', value }` to host
- Host calls existing `encodeWithBase64` / `decodeWithBase64` from `utils/shell.ts`
- Result returned via `webview.postMessage({ command: 'result', value })`
- Output rendered in a readonly textarea with a Copy button
- Inline error message if decode fails (e.g., invalid base64)

## Tab: Settings

- **Certs Folder** — text input showing `kubeseal.certsFolder` + Browse button that runs `kubeseal.setCertFolder` command
- **Active Certificate** — `<select>` dropdown populated by scanning configured folder for `*.pem`, `*.crt`, `*.cert` files; writes `kubeseal.activeCertFile` on change
- Panel calls `vscode.workspace.getConfiguration` on mount and re-renders on `onDidChangeConfiguration` so it stays in sync with changes made elsewhere (settings UI, command palette)
- If certs folder is not set, dropdown shows "Set a certs folder first" (disabled)

## Tab: Actions

- Active cert status badge: cert filename + green indicator if configured, red "No cert" if not
- **Encrypt File** button → executes `kubeseal.encrypt` command
- **Decrypt File** button → executes `kubeseal.decrypt` command
- Both buttons are disabled with a tooltip if no YAML file is open in the active editor
- Active editor state checked on tab focus and on `window.onDidChangeActiveTextEditor`

## package.json Contributions

```json
"viewsContainers": {
  "activitybar": [{
    "id": "kubeseal-sidebar",
    "title": "Kubeseal",
    "icon": "assets/panel-icon.svg"
  }]
},
"views": {
  "kubeseal-sidebar": [{
    "type": "webview",
    "id": "kubeseal.panel",
    "name": "Kubeseal"
  }]
}
```

## Error Handling

- Encode/decode errors surfaced inline in the Base64 tab output area (not as VS Code notifications)
- Settings writes that fail fall back to showing the previous value
- Actions tab commands use existing error handling from `commands/secrets.ts`

## Testing

- Existing `npm run test:base64` suite covers encode/decode logic — no changes needed there
- Manual verification: open panel, switch tabs, encode/decode a value, browse/select a cert, run encrypt/decrypt on a YAML file
- No new unit tests required (webview HTML is not unit-testable without a VS Code test harness)
