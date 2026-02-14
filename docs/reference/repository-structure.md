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
├── out/                        # Compiled JavaScript (generated)
├── .eslintrc.json              # ESLint configuration
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

Base64 encoding and decoding for Kubernetes Secret `data` fields:

- Detects already-encoded values to prevent double encoding
- Handles binary content detection during decoding
- Uses js-yaml for robust YAML parsing

#### `utils/shell.ts`

Security-focused shell execution:

- Uses `spawn()` instead of `exec()` to prevent command injection
- Supports cancellation via VS Code's cancellation token
- 30-second default timeout

#### `utils/validation.ts`

Input validation:

- RFC 1123 DNS label validation for Kubernetes names
- Base64 detection heuristics via `isProbablyBase64Value()`

#### `utils/yaml.ts`

YAML processing using the `js-yaml` library with type-safe parsing through TypeScript interfaces.
