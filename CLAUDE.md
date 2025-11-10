# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a GitHub repository template providing standardized starting point for new projects with pre-configured best practices, automated workflows, and tooling.

## Development Workflow

**CRITICAL:** Never commit directly to the `main` branch.

**Always create a feature branch:**

```bash
git checkout -b feat/your-feature-name
# OR
git checkout -b fix/bug-description
# OR
git checkout -b docs/documentation-update
```

After implementing changes, create a pull request for review. The main branch is protected and requires:

- PR review and approval
- All CI checks passing (lint, tests, security scans)
- Conventional Commits format for PR title

## Commit Message Convention

**CRITICAL:** All commits and PR titles MUST follow Conventional Commits format:

```
<type>(<scope>): <subject>
```

**Allowed Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `revert`

**Validation Rules (enforced by CI):**

- Subject must start with alphabetic character
- Scope is optional
- Use imperative mood ("add feature" not "added feature")
- PR titles are automatically validated with sticky comments on errors

## Development Commands

**Install pre-commit hooks (required before first commit):**

```bash
pre-commit install
```

**Run all hooks manually:**

```bash
pre-commit run --all-files
```

**Run specific hook:**

```bash
pre-commit run gitleaks --all-files
```

**Active Hooks:**

- **Basic**: trailing-whitespace, end-of-file-fixer, check-yaml, check-json, check-toml
- **Security**: gitleaks (--verbose), detect-private-key, check-added-large-files (max 1MB)
- **Quality**: check-merge-conflict, check-case-conflict, mixed-line-ending (fix to LF)
- **Linting**: markdownlint (auto-fix), yamllint (strict mode)

## Secret Scanning (Gitleaks)

**Runs:** Pre-commit hook + CI on PRs/pushes to main/master

**Allowlisted (`.gitleaks.toml`):**

- Documentation files: `*.md`, `*.txt`, `*.rst`, `LICENSE`, `CHANGELOG.md`
- Example secrets in docs (e.g., `AKIA[0-9A-Z]{16}`, `ghp_[0-9a-zA-Z]{36}`, test passwords)

**Add custom rules:** Edit `[[rules]]` section in `.gitleaks.toml`

## Automated Releases

**Trigger:** Pushes to main branch (or manual workflow_dispatch)

**Version Bumping:**

- `fix` → Patch (1.0.x)
- `feat` → Minor (1.x.0)
- `BREAKING CHANGE` in body → Major (x.0.0)

**Process:** Analyzes commits → Bumps version → Updates CHANGELOG.md → Creates GitHub release → Commits changelog with `chore(release): version X.Y.Z [skip ci]`

**Config:** `.releaserc.json` (branches: main/master, plugins: commit-analyzer, release-notes-generator, github, changelog, git)

## CI/CD Workflows

**On PRs:**

- `lint-pr.yaml` - Validates PR titles (Conventional Commits format, adds sticky comment on errors)
- `deps-review.yaml` - Reviews dependency changes
- `gitleaks.yaml` - Scans for secrets
- `codeql.yaml` - CodeQL security analysis (JavaScript, Python)

**On main branch:**

- `release.yaml` - Automated semantic-release (also manual via workflow_dispatch)
- `codeql.yaml` - Weekly scheduled security scans (Mondays at 00:00 UTC)

**Automated Maintenance:**

- `pre-commit-auto-update.yaml` - Updates hooks
- `stale.yaml` - Manages stale issues/PRs
- `template-repo-sync.yaml` - Syncs template updates
- `automerge.yaml` - Auto-merges PRs from dependabot and GitHub Actions bot
- Dependabot - Daily GitHub Actions dependency updates with `chore(deps):` commits

## Template Sync

When syncing template updates, files listed in `.templatesyncignore` are preserved (issue templates, VSCode config, pre-commit config, EditorConfig, CHANGELOG, CODEOWNERS, LICENSE, README, this file).

## Code Style

**EditorConfig:**

- Indent: 2 spaces
- Charset: UTF-8
- Line endings: LF
- Trim trailing whitespace (except `.diff`, `.md`)
- Insert final newline

**VSCode Settings:**

- Format on save enabled (Prettier)
- Auto-fix on save
- Git auto-fetch enabled
- Excluded from search: node_modules, build, dist, venv, pycache, coverage

**Git Attributes:**

- Auto-detect text files with LF line endings
- Language-specific diff drivers (markdown, JSON, YAML, Python, JavaScript)
- Binary file handling for images, archives, fonts

## Project Files

**Security & Contributing:**

- `SECURITY.md` - Vulnerability disclosure process and security measures
- `CONTRIBUTING.md` - Contribution guidelines, workflow, and code style

**Issue Templates:**

- Bug Report (`bug_report.md`)
- Feature Request (`feature_request.md`)
- Documentation Issue (`documentation.md`)
- Template config (`config.yml`) - Links to discussions and security advisories

**Configuration:**

- `.gitattributes` - Line ending and diff behavior
- `.gitignore` - Comprehensive ignore patterns for Python, Node.js, IDEs, OS files
