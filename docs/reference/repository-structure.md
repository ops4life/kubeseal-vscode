# Repository Structure

Overview of the project's directory structure and key files.

## Top-Level Structure

```
kubeseal-vscode/
├── .github/                    # GitHub configuration
│   ├── ISSUE_TEMPLATE/         # Issue templates
│   └── workflows/              # GitHub Actions workflows
├── .vscode/                    # VS Code workspace settings
├── docs/                       # MkDocs documentation source
├── src/                        # TypeScript source code
│   ├── commands/               # Command implementations
│   ├── types/                  # TypeScript type definitions
│   ├── ui/                     # UI components
│   └── utils/                  # Utility modules
├── tests/                      # YAML fixtures + standalone test runner
│   ├── run-tests.mjs           # Standalone base64 test suite
│   └── *.yaml                  # K8s Secret YAML test fixtures
├── out/                        # Compiled JavaScript (generated)
├── .eslintrc.json              # ESLint configuration
├── .pre-commit-config.yaml     # Pre-commit hook definitions
├── .prettierrc                 # Prettier configuration
├── CHANGELOG.md                # Auto-generated changelog
├── CLAUDE.md                   # Claude Code instructions
├── LICENSE                     # MIT License
├── mkdocs.yml                  # MkDocs configuration
├── package.json                # Node.js package manifest
├── README.md                   # Project README
├── requirements.txt            # Python dependencies (docs)
└── tsconfig.json               # TypeScript configuration
```

## Source Code Architecture

```
src/
├── extension.ts                # Entry point, command registration
├── commands/
│   ├── base64.ts              # Base64 encode/decode commands
│   ├── certificates.ts        # Certificate management commands
│   └── secrets.ts             # Encrypt/decrypt commands
├── types/
│   └── kubernetes.ts          # TypeScript type definitions for K8s resources
├── ui/
│   └── statusBar.ts           # Status bar management
└── utils/
    ├── shell.ts               # Shell command execution (spawn-based)
    ├── validation.ts          # Input validation and security checks
    └── yaml.ts                # YAML parsing using js-yaml
```

### Key Modules

#### `extension.ts`

Entry point that registers all VS Code commands and initializes the status bar.

#### `commands/secrets.ts`

Handles encryption and decryption:

- **Encrypt**: Reads a Secret YAML, runs `kubeseal` with the active certificate, writes a `*-sealed.yaml` file
- **Decrypt**: Extracts metadata from a SealedSecret YAML, runs `kubectl get secret`, writes a `*-unsealed.yaml` file

#### `commands/certificates.ts`

Certificate management system:

- Configures the certificate folder path
- Lists available certificates (`.pem`, `.crt`, `.cert`)
- Manages the active certificate selection
- Updates the status bar indicator

#### `commands/base64.ts`

Base64 encoding and decoding for Kubernetes Secret `data` and `stringData` fields:

- **Encode**: Uses a roundtrip check (`decode → re-encode → compare`, with whitespace normalisation) to detect already-encoded values and avoid double-encoding. Promotes `stringData` entries to `data`. Relies on `encodeWithBase64()` from `utils/shell.ts`.
- **Decode**: Decodes ALL `.data` values unconditionally — the K8s spec guarantees they are base64. Skips binary content (null bytes, control chars) to preserve certs/keys as-is.
- Both operations delegate to `encodeWithBase64` / `decodeWithBase64` in `utils/shell.ts` which pipe through the system `base64` binary.

#### `utils/shell.ts`

Security-focused shell execution:

- Uses `spawn()` instead of `exec()` to prevent command injection
- Supports cancellation via VS Code's cancellation token
- 30-second default timeout
- `encodeWithBase64(value)`: pipes UTF-8 value through system `base64` → returns single-line encoded string
- `decodeWithBase64(encoded)`: pipes through `base64 -D` (macOS) / `base64 -d` (Linux) → collects raw Buffer chunks to correctly handle all Unicode and multi-byte sequences

#### `utils/validation.ts`

Input validation:

- RFC 1123 DNS label validation for Kubernetes names
- `isProbablyBase64Value()` retained for legacy reference; base64 detection in commands now uses terminal roundtrip via `utils/shell.ts`

#### `utils/yaml.ts`

YAML processing using the `js-yaml` library with type-safe parsing through TypeScript interfaces.

## Test Fixtures

All YAML files in `tests/` are K8s Secret fixtures used by the standalone test runner (`tests/run-tests.mjs`).

| File | Purpose |
|------|---------|
| `basic-encode-test.yaml` | Mix of plaintext and already-encoded values |
| `decode-test.yaml` | All valid base64 values to be decoded |
| `unicode-test.yaml` | Unicode, emoji, special symbols |
| `edge-cases-test.yaml` | Multiline, padding variants, YAML keywords |
| `mixed-content-test.yaml` | Mixed plaintext + base64 in same secret |
| `stringdata-test.yaml` | `stringData` field promotion to `data` |
| `binary-content-test.yaml` | PNG / cert / ZIP — should stay as base64 |
| `comments-test.yaml` | Values with inline YAML comments |
| `not-secret-test.yaml` | ConfigMap — should be rejected |
| `no-data-field-test.yaml` | Secret with no `data` field — no-op |
