# CI/CD Workflows

This project uses GitHub Actions for continuous integration and deployment. Here's an overview of all workflows.

## CI Pipeline

**File:** `.github/workflows/ci.yaml`
**Triggers:** Pull requests to `main` and `develop`

Runs the following checks on every pull request:

| Job | Description |
|-----|-------------|
| **Lint and Format** | ESLint and Prettier checks |
| **Package Extension** | Verifies the extension packages correctly |
| **Security Scan** | `npm audit` and optional Snyk scanning |
| **Validate Manifest** | Checks required `package.json` fields |
| **Compatibility Check** | Verifies VS Code engine compatibility |

## Release Pipeline

**File:** `.github/workflows/release.yaml`
**Triggers:** Push to `main`

Handles automatic versioning and publishing:

1. Analyzes commit messages using semantic-release
2. Bumps version in `package.json` based on [commit conventions](commit-conventions.md)
3. Creates a GitHub Release with changelog
4. Packages and uploads the VSIX file
5. Publishes to VS Code Marketplace (if PAT is configured)

!!! info "Manual trigger"
    You can manually trigger a release from GitHub Actions → "Release and Publish Extension" → "Run workflow".

## Documentation Pipeline

**File:** `.github/workflows/docs-deploy.yaml`
**Triggers:** Push to `main` (when docs/\*\*, mkdocs.yml, or requirements.txt change)

Builds and deploys the documentation site to GitHub Pages:

1. Validates documentation builds on pull requests
2. Auto-configures repository URLs in `mkdocs.yml`
3. Builds the MkDocs site
4. Deploys to GitHub Pages

## Other Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| **CodeQL** | `codeql.yaml` | Code security analysis |
| **Gitleaks** | `gitleaks.yaml` | Scans for leaked secrets |
| **Dependency Review** | `deps-review.yaml` | Reviews dependency changes in PRs |
| **Lint PR** | `lint-pr.yaml` | Validates PR title follows conventional commits |
| **Pre-commit CI** | `pre-commit-ci.yaml` | Runs pre-commit hooks in CI |
| **Stale** | `stale.yaml` | Marks and closes stale issues/PRs |
| **Cleanup Caches** | `cleanup-caches.yaml` | Cleans up old GitHub Actions caches |
| **Template Sync** | `template-repo-sync.yaml` | Syncs with upstream template repository |
| **Backfill VSIX** | `backfill-vsix.yaml` | Backfills VSIX files to existing releases |
| **Pre-commit Auto Update** | `pre-commit-auto-update.yaml` | Keeps pre-commit hooks up to date |
