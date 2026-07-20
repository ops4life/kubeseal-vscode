# View Decoded Secret (Panel) — Design

## Goal

Let the user pick a live Kubernetes Secret from the cluster (namespace + name)
directly in the panel, decode its `.data` values, and open the result in a new
editor tab to view — without needing a SealedSecret/Secret YAML file open
first.

## Scope

Panel-only. No new command-palette command, no new `contributes.commands`
entry in `package.json`.

## UI

New third tab in `KubesealPanelProvider`, alongside existing **Tools** and
**Settings** tabs: **View**.

Contents:
1. **Namespace** dropdown — populated on tab activation.
2. **Secret** dropdown — populated whenever the namespace selection changes;
   disabled/placeholder until a namespace is chosen.
3. **View Decoded Secret** button — disabled until both dropdowns have a
   selection.
4. Error banner (reuses `.md-error` styling) for kubectl failures, empty
   namespace list, empty secret list, or decode failures.

## Data Flow

1. User opens View tab → webview posts `listNamespaces`.
2. Extension runs `kubectl get ns -o jsonpath='{.items[*].metadata.name}'`,
   replies `namespacesResult` with the array. Empty/error → banner shown,
   dropdown shows disabled placeholder.
3. User selects a namespace → webview posts `listSecrets { namespace }`.
4. Extension runs `kubectl get secrets -n <namespace> -o
   jsonpath='{.items[*].metadata.name}'`, replies `secretsResult`.
5. User selects a secret, clicks **View Decoded Secret** → webview posts
   `viewSecret { namespace, name }`.
6. Extension:
   - Validates `namespace` and `name` with `isValidKubernetesName` (defense in
     depth; values originate from a dropdown built from prior kubectl output,
     not free text, but every value crossing into a spawned process arg gets
     validated here as elsewhere in the codebase).
   - Runs `kubectl get secret <name> -n <namespace> -o yaml`.
   - Confirms `isKubernetesSecret`, parses with `parseSecret`.
   - Runs the shared `decodeSecretData` helper (see below) to decode all
     `.data` values in place, skipping binary content per existing rules.
   - Serializes with `toYaml`, writes to
     `path.join(os.tmpdir(), '{namespace}-{name}-decoded.yaml')`.
   - Opens the file with `vscode.workspace.openTextDocument` +
     `vscode.window.showTextDocument`.
   - Replies success/error to the webview; webview clears any spinner state
     and shows/hides the error banner.

## Backend Changes

### `utils/shell.ts`

Three new functions, following the existing `execWithCancellation` pattern
(30s default timeout, cancellation support):

```ts
listNamespaces(token: vscode.CancellationToken): Promise<string[]>
listSecrets(namespace: string, token: vscode.CancellationToken): Promise<string[]>
getSecretYaml(namespace: string, name: string, token: vscode.CancellationToken): Promise<string>
```

`listNamespaces`/`listSecrets` parse the whitespace-separated jsonpath output
into a string array (empty stdout → empty array, not an error).

### `utils/yaml.ts` or `commands/base64.ts`

Extract the per-key decode loop currently inlined in `decodeBase64Values`
(binary detection, whitespace-trim tracking, `decodeWithBase64` calls) into an
exported helper:

```ts
async function decodeSecretData(secret: KubernetesSecret): Promise<{
  decodedCount: number;
  skippedBinaryCount: number;
  whitespaceKeys: string[];
}>
```

Mutates `secret.data` in place. `decodeBase64Values` (file-based) and the new
`viewDecryptedSecret` (cluster-based) both call this — no duplicated
binary-detection logic between the two call sites.

### `commands/secrets.ts`

New function:

```ts
async function viewDecryptedSecret(
  namespace: string,
  name: string,
  token: vscode.CancellationToken
): Promise<void>
```

Implements step 6 of the data flow above. Reuses the existing error-reporting
conventions in this file (try/catch, `logError`, `vscode.window.showErrorMessage`
with actionable buttons where it makes sense — e.g. "Check kubectl Access").

### `ui/panelProvider.ts`

- New message handlers: `listNamespaces`, `listSecrets`, `viewSecret`.
- Each handler creates its own `vscode.CancellationTokenSource`, disposed in a
  `finally` block after the call completes.
- New webview state/markup for the View tab: two `<select>` elements, a
  primary button, and an error banner, styled consistently with the existing
  Base64/Settings tabs (`.md-select`, `.md-btn`, `.md-error`).
- No changes to `PanelState`/`_sendState` — namespace/secret lists are fetched
  on-demand via dedicated messages, not part of the general state push (they
  can be slow/cluster-dependent and shouldn't block every `refresh()`).

## Output File Location

`os.tmpdir()`, not the workspace. Rationale: a live-cluster secret decoded to
plaintext YAML sitting in the workspace risks being staged/committed by
accident. The temp file still opens directly in the editor for viewing/copying
values; the user can save it elsewhere explicitly if they want to keep it.

## Error Handling

- kubectl not installed / not in PATH → surfaces via the existing
  `execWithCancellation` rejection path ("Failed to execute command: ...").
- No cluster access / bad kubeconfig → kubectl's stderr surfaces via the
  existing "Command failed with exit code ..." path.
- Empty namespace or secret list → dropdown shows a disabled placeholder
  option ("No namespaces found" / "No secrets found"), button stays disabled.
- Decode failure on an individual key → same behavior as
  `decodeBase64Values` today: warning shown, other keys still processed.

## Out of Scope

- No new command-palette command or keybinding.
- No change to certificate management, encrypt/decrypt-from-file commands, or
  the existing Base64/Settings tabs beyond adding the third tab.
- No caching of namespace/secret lists across panel reloads — always fetched
  fresh when the View tab is opened / namespace changes.
