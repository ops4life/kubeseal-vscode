# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that integrates Kubeseal (Bitnami Sealed Secrets) into VS Code, allowing users to encrypt/decrypt Kubernetes secrets and encode/decode base64 values directly from the editor.

**Key dependencies:**
- Requires `kubeseal` binary in PATH for encryption operations
- Requires `kubectl` binary in PATH for decryption operations (fetches from cluster)
- Targets Node.js 20+ and VS Code 1.80.0+

## Development Commands

### Building and Testing
```bash
# Compile TypeScript to JavaScript (output: out/)
npm run compile

# Watch mode for development
npm run watch

# Run the base64 encode/decode test suite (standalone, no VS Code runtime needed)
npm run test:base64

# Run full VS Code integration tests
npm test

# Build for production (used before publishing)
npm run vscode:prepublish
```

### Linting and Formatting
```bash
# Run ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without modifying files
npm run format:check
```

### Packaging and Publishing
```bash
# Package extension as VSIX file
npm run package

# Clean build artifacts
npm run clean
```

## Architecture

### Extension Structure

The extension is organized into a modular structure for maintainability and testability:

```
src/
├── extension.ts              # Entry point, command registration
├── commands/
│   ├── base64.ts            # Base64 encode/decode commands
│   ├── certificates.ts      # Certificate management commands
│   └── secrets.ts           # Encrypt/decrypt commands
├── types/
│   └── kubernetes.ts        # TypeScript type definitions for K8s resources
├── ui/
│   ├── statusBar.ts         # Status bar management
│   └── panelProvider.ts     # Activity bar panel webview (Tools/View/Settings tabs)
└── utils/
    ├── shell.ts             # Shell command execution (uses spawn for security)
    ├── validation.ts        # Input validation and security checks
    └── yaml.ts              # YAML parsing using js-yaml library
```

**Commands registered:**
- `kubeseal.encrypt` - Encrypts a Kubernetes Secret using kubeseal with the active certificate
- `kubeseal.decrypt` - Retrieves the original secret from the cluster using kubectl
- `kubeseal.setCertFolder` - Opens folder picker to configure certificate directory
- `kubeseal.selectCertificate` - Shows quick pick menu to select active certificate from configured folder
- `kubeseal.encodeBase64` - Encodes plain text values in Secret's `data` field to base64
- `kubeseal.decodeBase64` - Decodes base64 values in Secret's `data` field to plain text

**Core concepts:**

1. **Certificate Management System** (`commands/certificates.ts`):
   - Users configure a folder containing multiple certificate files (`.pem`, `.crt`, `.cert`)
   - One certificate is marked as "active" and used for all encryption operations
   - Status bar item shows currently active certificate and provides quick access to switch certificates
   - Configuration stored in workspace settings: `kubeseal.certsFolder` and `kubeseal.activeCertFile`

2. **Security-First Shell Execution** (`utils/shell.ts`):
   - Uses `spawn()` instead of `exec()` to prevent command injection vulnerabilities
   - All shell commands use parameterized execution with proper argument separation
   - Input validation via `utils/validation.ts` ensures K8s names follow RFC 1123 DNS label standard
   - All commands support cancellation via VS Code's cancellation token
   - Default timeout: 30 seconds for shell commands

3. **YAML Processing** (`utils/yaml.ts`):
   - Uses `js-yaml` library for robust YAML parsing instead of fragile regex
   - Type-safe parsing with TypeScript interfaces defined in `types/kubernetes.ts`
   - Handles complex YAML structures correctly including nested objects and arrays

4. **File Naming Convention**:
   - Encrypted files: `{original-name}-sealed.yaml`
   - Decrypted files: `{original-name}-unsealed.yaml`

5. **Decryption via Cluster** (`commands/secrets.ts`):
   - Decryption extracts the secret name and namespace from the SealedSecret YAML using `extractSecretMetadata()`
   - Validates metadata to prevent command injection before executing kubectl
   - Uses `kubectl get secret` to retrieve the actual secret from the cluster
   - This means decryption requires cluster access and that the SealedSecret has been deployed

6. **Base64 Handling** (`commands/base64.ts`, `utils/shell.ts`):
   - Uses Node's built-in **`Buffer`** for encode/decode — not an external `base64` binary, so behavior is identical on Windows, macOS, and Linux (no dependency on a `base64` CLI existing in PATH, which Windows lacks natively)
   - `encodeWithBase64(value)` in `utils/shell.ts`: `Buffer.from(value, 'utf8').toString('base64')`, no line wrapping
   - `decodeWithBase64(encoded)` in `utils/shell.ts`: validates input against a strict RFC 4648 base64 regex (throws on invalid input, matching what `base64 -d` would reject), then `Buffer.from(encoded, 'base64').toString('utf8')` — decoded in one shot to preserve multi-byte UTF-8 sequences (emoji, CJK, Arabic, etc.)
   - **Encode strategy**: roundtrip check (`decode → re-encode → compare`) to detect already-encoded values; normalises whitespace before comparison to handle line-wrapped base64 (TLS certs, SSH keys). Encodes `stringData` values and promotes them to `data`.
   - **Decode strategy**: decodes ALL values in `.data` unconditionally — K8s Secret spec guarantees every `.data` value is base64. No heuristic detection needed.
   - Binary detection post-decode (null bytes / control chars) keeps certs/keys as base64 in the YAML
   - Decode logic (binary detection, whitespace-trim tracking) lives in the exported `decodeSecretData(secret)` helper in `commands/base64.ts`, mutating `secret.data` in place — shared by `decodeBase64Values` (file-based) and `viewDecryptedSecret` (cluster-based, see below)
   - Test suite: `tests/run-tests.mjs` — 174 assertions across all 10 YAML fixtures, runnable with `npm run test:base64`

7. **View Decoded Secret from Cluster** (panel-only, `commands/secrets.ts` + `ui/panelProvider.ts`):
   - Panel's **View** tab lets the user pick a namespace and secret name from dropdowns populated live via `kubectl get ns` / `kubectl get secrets -n <ns>` (`listNamespaces`/`listSecrets` in `utils/shell.ts`); results are sorted alphabetically so typing a letter jumps to the right entry
   - On selection, `viewDecryptedSecret(namespace, name, token)` fetches the Secret with `kubectl get secret -o yaml` (`getSecretYaml`), decodes all `.data` values via `decodeSecretData`, and writes the result to `os.tmpdir()/{namespace}-{name}-decoded.yaml` — **not** the workspace, to avoid an accidentally-committed plaintext secret
   - The decoded file is opened directly in the editor for viewing
   - No new command-palette command or `contributes.commands` entry — this flow is panel-only

### Configuration Settings

```typescript
kubeseal.certsFolder: string       // Path to certificate folder
kubeseal.activeCertFile: string    // Filename of active certificate
```

## Release Process

This project uses semantic-release for automatic versioning based on conventional commit messages:

**Commit message format:**
- `fix:` - Patch version bump (e.g., 1.0.0 → 1.0.1)
- `feat:` - Minor version bump (e.g., 1.0.0 → 1.1.0)
- `feat!:` or `fix!:` or `BREAKING CHANGE:` in footer - Major version bump (e.g., 1.0.0 → 2.0.0)
- Other types (`docs:`, `chore:`, `refactor:`, etc.) - No version bump

**Breaking changes:**
Breaking changes MUST be indicated in the commit message. There are two ways to do this:

1. Add `!` after the type/scope (e.g., `feat!:`, `fix!:`, `refactor!:`)
   ```
   feat!: require kubeseal binary in PATH

   Remove fallback to bundled kubeseal binary
   ```

2. Add `BREAKING CHANGE:` in the commit footer
   ```
   feat: update encryption algorithm

   BREAKING CHANGE: Sealed secrets created with older versions
   will need to be re-encrypted with the new algorithm.
   ```

**When to mark as breaking change:**
- Removing or renaming public APIs, commands, or configuration options
- Changing default behavior that users depend on
- Requiring new dependencies or system requirements
- Incompatible data format changes
- Removing support for older versions of tools/platforms

**Release workflow:**
1. Push commits to `main` branch with conventional commit messages
2. GitHub Actions workflow automatically runs semantic-release
3. If version bump is needed: Updates package.json, creates GitHub release, uploads VSIX, publishes to marketplace (if PAT configured)
4. If no version bump: Workflow completes without creating a release

**Manual release trigger:**
Go to GitHub Actions → "Release and Publish Extension" → "Run workflow"

## Git Workflow

**IMPORTANT: Always use feature branches - NEVER commit directly to `main`**

When implementing features, bug fixes, or making any code changes:

1. **Create a feature branch** with conventional naming:
   - Features: `feat/feature-name`
   - Bug fixes: `fix/bug-name`
   - Documentation: `docs/description`
   - Refactoring: `refactor/description`

2. **Commit changes** to the feature branch with conventional commit messages
   - Do NOT include AI attribution (e.g., "Generated with Claude Code") in commit messages
   - Commit messages should be clean and professional without AI-related footers

3. **Push the feature branch** to remote

4. **Create a Pull Request** for review before merging to `main`

Example workflow:
```bash
git checkout -b feat/new-feature
# Make changes
git add .
git commit -m "feat: add new feature"
git push -u origin feat/new-feature
# Create PR on GitHub
```

> [!NOTE]
> See `.claude/rules/build-vsix.md` — VSIX packaging is required after every implementation, before declaring the task done.

This ensures:
- All changes go through CI checks
- Code review process is followed
- Clean git history on `main` branch
- Protection of the main branch


## Code Style

- TypeScript with strict mode enabled
- ESLint configuration uses `@typescript-eslint/recommended`
- Naming convention: camelCase for imports
- Semicolons required
- Curly braces required for control structures
- Use `===` for equality checks
- Use `unknown` instead of `any` for type safety
- Use async/await with `promises as fs` for file operations instead of sync methods
- Prefer `spawn()` over `exec()` for shell commands to prevent injection attacks
