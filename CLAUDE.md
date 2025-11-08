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

# Run tests
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
│   └── statusBar.ts         # Status bar management
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

6. **Base64 Handling** (`commands/base64.ts`, `utils/validation.ts`):
   - `isProbablyBase64Value()` function uses heuristics to detect if a value is already base64 encoded
   - Uses js-yaml for parsing instead of regex-based YAML manipulation
   - Encoding: Converts plain text to base64, skips already-encoded values
   - Decoding: Converts base64 to plain text, preserves binary data as base64
   - Detects printable vs binary content to determine if decoding should be performed

### Configuration Settings

```typescript
kubeseal.certsFolder: string       // Path to certificate folder
kubeseal.activeCertFile: string    // Filename of active certificate
kubeseal.kubesealPath: string      // Path to kubeseal binary (default: "kubeseal")
```

## Release Process

This project uses semantic-release for automatic versioning based on conventional commit messages:

**Commit message format:**
- `fix:` - Patch version bump (e.g., 1.0.0 → 1.0.1)
- `feat:` - Minor version bump (e.g., 1.0.0 → 1.1.0)
- `feat!:` or `BREAKING CHANGE:` - Major version bump (e.g., 1.0.0 → 2.0.0)
- Other types (`docs:`, `chore:`, `refactor:`, etc.) - No version bump

**Release workflow:**
1. Push commits to `main` branch with conventional commit messages
2. GitHub Actions workflow automatically runs semantic-release
3. If version bump is needed: Updates package.json, creates GitHub release, uploads VSIX, publishes to marketplace (if PAT configured)
4. If no version bump: Workflow completes without creating a release

**Manual release trigger:**
Go to GitHub Actions → "Release and Publish Extension" → "Run workflow"

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
