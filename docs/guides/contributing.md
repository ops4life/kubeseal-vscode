# Contributing Guide

Contributions are welcome! This guide will help you get started with development on the Kubeseal VSCode extension.

## Development Setup

### Prerequisites

- Node.js 20+
- npm
- VS Code 1.80.0+
- Git

### Getting Started

1. **Fork and clone** the repository:

    ```bash
    git clone https://github.com/ops4life/kubeseal-vscode.git
    cd kubeseal-vscode
    ```

2. **Install dependencies**:

    ```bash
    npm install
    ```

3. **Compile the extension**:

    ```bash
    npm run compile
    ```

4. **Open in VS Code**:

    ```bash
    code .
    ```

5. **Run the extension** by pressing `F5` to launch the Extension Development Host.

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode for development |
| `npm run test:base64` | Run base64 encode/decode test suite (fast, no VS Code runtime) |
| `npm test` | Run full VS Code integration tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without modifying |
| `npm run package` | Package extension as VSIX |
| `npm run clean` | Clean build artifacts |

## Git Workflow

!!! warning "Never commit directly to `main`"
    Always use feature branches and create Pull Requests.

### Branch Naming

Use conventional branch names:

- `feat/feature-name` -- New features
- `fix/bug-name` -- Bug fixes
- `docs/description` -- Documentation changes
- `refactor/description` -- Code refactoring

### Workflow

```bash
# Create a feature branch
git checkout -b feat/my-feature

# Make your changes and commit
git add .
git commit -m "feat: add my new feature"

# Push and create a PR
git push -u origin feat/my-feature
```

See [Commit Conventions](commit-conventions.md) for commit message formatting.

## Code Style

- TypeScript with strict mode enabled
- ESLint with `@typescript-eslint/recommended` rules
- Prettier for code formatting
- Naming convention: `camelCase` for imports and variables
- Use `===` for equality checks
- Use `unknown` instead of `any` for type safety
- Use `async/await` with `promises as fs` for file operations
- Use `spawn()` over `exec()` for shell commands (security)

## Testing

The project has two test runners:

### Base64 Test Suite (standalone)

A fast, standalone test suite that exercises the encode/decode logic against all YAML fixtures in `tests/`. No VS Code runtime required.

```bash
npm run test:base64
```

Runs 174 assertions across all 10 YAML fixtures covering:

- Special characters: emoji, CJK, Arabic, `@#$%^&*`, newlines, tabs, URLs
- Already-encoded detection: roundtrip check prevents double-encoding
- Binary content: PNG / ZIP / JPEG / certs kept as base64
- Edge cases: multiline values, padding variants, YAML keywords (`true`, `null`, `123`)
- `stringData` → `data` promotion

### Full VS Code Test Suite

```bash
npm test
```

Compiles TypeScript first, then runs the full VS Code extension test runner.

## Pre-commit Hooks

The repository uses [pre-commit](https://pre-commit.com/) to enforce quality gates before every commit.
Install the hooks once after cloning:

```bash
pre-commit install
```

Hooks that run automatically:

| Hook | Triggers on | Action |
|------|-------------|--------|
| `trailing-whitespace` | Any file | Removes trailing whitespace |
| `end-of-file-fixer` | Any file | Ensures files end with newline |
| `check-yaml` | `*.yaml` / `*.yml` | Validates YAML syntax |
| `mkdocs-build` | `docs/`, `mkdocs.yml` | Full mkdocs strict build |
| `typecheck` | `*.ts`, `*.json` | `tsc --noEmit` type check |
| `base64-tests` | `src/commands/base64.ts`, `src/utils/shell.ts`, `tests/` | Runs the base64 test suite |

To run hooks manually against specific files:

```bash
pre-commit run --files src/commands/base64.ts src/utils/shell.ts
```

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Make your changes with clear, conventional commit messages
3. Ensure all tests pass (`npm test`)
4. Ensure code passes linting (`npm run lint`)
5. Ensure code is formatted (`npm run format:check`)
6. Open a Pull Request with a clear description of changes
7. Wait for CI checks to pass and request review

## Reporting Issues

- Open an issue on [GitHub](https://github.com/ops4life/kubeseal-vscode/issues)
- Start a discussion in the [Discussions tab](https://github.com/ops4life/kubeseal-vscode/discussions)
