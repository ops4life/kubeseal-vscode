# Start feature branches from up-to-date main

Before starting any new feature/fix implementation, always branch from a
freshly pulled `main` — never from whatever branch happens to be checked
out, and never from a stale local `main`:

```bash
git checkout main && git pull origin main
git checkout -b feat/feature-name   # or fix/, docs/, refactor/...
```

Skipping the pull risks branching from a `main` that's already missing
merged work (a previous PR, a squash-merged duplicate of the same
feature), which surfaces later as rebase conflicts or duplicate-commit
history — see the `feat/panel-key-list-encode` branch, which had to be
rebased and had two commits dropped because an equivalent PR (#71) had
already landed on `main` under different commit SHAs.

Applies on top of the existing "Git Workflow" section in `CLAUDE.md`
(feature-branch naming, no direct commits to `main`).
