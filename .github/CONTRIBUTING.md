# Contributing Guidelines

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Workflow](#contribution-workflow)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Code of Conduct](#code-of-conduct)

## Getting Started

1. **Fork the Repository**
   - Click the "Fork" button at the top right of the repository page
   - This creates a copy of the repository in your GitHub account

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR-USERNAME/REPOSITORY-NAME.git
   cd REPOSITORY-NAME
   ```

3. **Add Upstream Remote**

   ```bash
   git remote add upstream https://github.com/ORIGINAL-OWNER/REPOSITORY-NAME.git
   ```

## Development Setup

1. **Install Pre-commit Hooks** (Required)

   ```bash
   pre-commit install
   ```

2. **Verify Installation**

   ```bash
   pre-commit run --all-files
   ```

3. **Create a Feature Branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```

## Contribution Workflow

1. **Keep Your Fork Updated**

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Make Your Changes**
   - Write clear, concise code
   - Follow existing code patterns
   - Add tests if applicable
   - Update documentation as needed

3. **Test Your Changes**

   ```bash
   # Run pre-commit hooks
   pre-commit run --all-files

   # Run any project-specific tests
   # (add commands here based on your project)
   ```

4. **Commit Your Changes**
   - Follow the [Commit Message Guidelines](#commit-message-guidelines)
   - Keep commits atomic and focused
   - Each commit should represent a single logical change

5. **Push to Your Fork**

   ```bash
   git push origin feat/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to your fork on GitHub
   - Click "Compare & pull request"
   - Fill out the pull request template
   - Link any related issues

## Commit Message Guidelines

This project follows [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Commit Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes only
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `test`: Adding or updating tests
- `chore`: Changes to build process, dependencies, or auxiliary tools
- `ci`: Changes to CI/CD configuration
- `revert`: Reverting a previous commit

### Examples

```bash
# Feature
feat(auth): add OAuth2 authentication

# Bug fix
fix(api): resolve null pointer exception in user endpoint

# Documentation
docs: update README with installation instructions

# Multiple scopes
feat(ui,api): implement user profile page
```

### Rules

- Subject must start with an alphabetic character
- Use imperative mood ("add feature" not "added feature")
- Don't capitalize the first letter of the subject
- No period at the end of the subject
- Scope is optional but recommended
- Keep subject line under 72 characters
- Separate subject from body with a blank line
- Wrap body at 72 characters

## Pull Request Process

1. **Before Submitting**
   - Ensure all tests pass
   - Run pre-commit hooks successfully
   - Update documentation if needed
   - Rebase your branch if necessary

2. **Pull Request Requirements**
   - Title must follow Conventional Commits format
   - Description clearly explains the changes
   - Link related issues using keywords (fixes #123, closes #456)
   - All CI checks must pass
   - At least one approval from a maintainer

3. **Review Process**
   - Maintainers will review your PR within a few days
   - Address feedback by pushing new commits
   - Use `git commit --fixup` for small fixes
   - Request re-review after addressing feedback

4. **Merging**
   - PRs are typically merged using "Squash and merge"
   - Ensure the final commit message follows Conventional Commits
   - Delete your branch after merging

## Code Style

- **Indentation**: 2 spaces (enforced by EditorConfig)
- **Line Endings**: LF (Unix-style)
- **Charset**: UTF-8
- **Trailing Whitespace**: Remove (automated by pre-commit)
- **Final Newline**: Required (automated by pre-commit)

### Language-Specific Guidelines

Follow the coding conventions for each language:

- **Python**: PEP 8
- **JavaScript/TypeScript**: Standard/Prettier
- **YAML**: 2-space indentation, no tabs
- **Markdown**: Use reference-style links for readability

## Code of Conduct

### Our Standards

- Be respectful and professional
- Welcome newcomers and help them learn
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other contributors

### Unacceptable Behavior

- Harassment, discrimination, or abuse
- Trolling, insulting comments, or personal attacks
- Publishing others' private information
- Other conduct that could reasonably be considered inappropriate

### Enforcement

Violations may result in:

1. Warning from maintainers
2. Temporary or permanent ban from the project
3. Reporting to GitHub

## Questions or Need Help?

- **Questions**: Open a [Discussion](../../discussions)
- **Bug Reports**: Open an [Issue](../../issues/new?template=bug_report.md)
- **Feature Requests**: Open an [Issue](../../issues/new?template=feature_request.md)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see [LICENSE](../../LICENSE)).

---

Thank you for contributing! Your efforts help make this project better for everyone.
