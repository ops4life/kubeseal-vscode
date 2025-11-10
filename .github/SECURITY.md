# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly. **Do NOT publicly disclose security vulnerabilities.**

### How to Report

1. **GitHub Security Advisories** (Recommended)
   - Navigate to the "Security" tab of this repository
   - Click "Report a vulnerability"
   - Fill out the vulnerability report form

2. **Email**
   - Contact the maintainers via email
   - Include a detailed description of the vulnerability
   - Provide steps to reproduce if possible

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (if you have them)
- Your contact information for follow-up

## Security Measures

This project implements several security measures:

### Automated Security Scanning

- **Gitleaks**: Secret scanning in pre-commit hooks and CI/CD
- **Dependabot**: Automated dependency vulnerability updates
- **Dependency Review**: Supply chain security analysis on pull requests
- **GitHub Actions**: Workflow security with minimal permissions

### Development Security

- **Pre-commit Hooks**: Automated security checks before commits
- **Conventional Commits**: Enforced commit message format
- **Branch Protection**: Required reviews and status checks on main branch

## Security Update Process

1. **Vulnerability Assessment**: We assess reported vulnerabilities within 48 hours
2. **Fix Development**: Critical vulnerabilities are prioritized immediately
3. **Testing**: All security fixes are thoroughly tested
4. **Release**: Security updates are released as patch versions
5. **Disclosure**: Public disclosure occurs after fix is released

## Responsible Disclosure

We ask security researchers to:

- Give us reasonable time to respond and fix vulnerabilities before public disclosure
- Avoid privacy violations, data destruction, or service disruption
- Avoid accessing or modifying other users' data
- Act in good faith to avoid violating privacy and disrupting our services

## Supported Versions

As a template repository, we recommend always using the latest version. Security updates are applied to the main branch.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| Older   | :x:                |

## Security Best Practices for Users

When using this template:

1. **Install pre-commit hooks**: Run `pre-commit install` immediately
2. **Review and customize**: Adjust `.gitleaks.toml` allowlists for your project
3. **Enable branch protection**: Configure GitHub branch protection rules
4. **Update dependencies**: Keep dependencies up-to-date with Dependabot
5. **Rotate secrets**: Never commit secrets; rotate if accidentally exposed
6. **Use signed commits**: Enable GPG signing for commits

## Contact

For security-related questions or concerns, please contact the repository maintainers.

## Acknowledgments

We appreciate the security research community's efforts to responsibly disclose vulnerabilities and keep open source projects secure.
