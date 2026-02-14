# Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning with semantic-release.

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types and Version Bumps

| Type | Description | Version Bump |
|------|-------------|-------------|
| `fix` | Bug fix | Patch (1.0.0 → 1.0.1) |
| `feat` | New feature | Minor (1.0.0 → 1.1.0) |
| `feat!` / `fix!` | Breaking change | Major (1.0.0 → 2.0.0) |
| `docs` | Documentation only | No release |
| `chore` | Maintenance tasks | No release |
| `refactor` | Code refactoring | No release |
| `test` | Adding or updating tests | No release |
| `ci` | CI/CD changes | No release |
| `style` | Formatting, whitespace | No release |
| `perf` | Performance improvements | No release |

## Examples

### Patch Release

```
fix: resolve certificate path resolution on Windows
```

### Minor Release

```
feat: add support for multiple namespace encryption
```

### Major Release (Breaking Change)

Using `!` after the type:

```
feat!: require kubeseal binary in PATH

Remove fallback to bundled kubeseal binary
```

Using `BREAKING CHANGE` footer:

```
feat: update encryption algorithm

BREAKING CHANGE: Sealed secrets created with older versions
will need to be re-encrypted with the new algorithm.
```

## When to Mark as Breaking Change

- Removing or renaming commands or configuration options
- Changing default behavior that users depend on
- Requiring new dependencies or system requirements
- Incompatible data format changes
- Removing support for older versions of tools or platforms

## Scoped Commits

You can optionally add a scope for more context:

```
feat(certificates): add certificate expiry warnings
fix(base64): handle multi-line values correctly
docs(readme): update installation instructions
```
