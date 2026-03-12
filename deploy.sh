#!/usr/bin/env bash
set -euo pipefail

# --- WAB Deploy Script ---
# Adds all tracked/new files, commits, and pushes to GitHub.
# Usage: ./deploy.sh "your commit message"

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# Default commit message
MSG="${1:-Update WAB project}"

echo "==> Staging changes..."
git add -A

# Check if there is anything to commit
if git diff --cached --quiet; then
  echo "Nothing to commit. Working tree is clean."
  exit 0
fi

echo "==> Committing: $MSG"
git commit -m "$MSG"

echo "==> Pushing to origin..."
git push origin "$(git branch --show-current || echo main)"

echo "==> Done! Pushed to $(git remote get-url origin)"
