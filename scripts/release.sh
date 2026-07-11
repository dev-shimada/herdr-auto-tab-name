#!/usr/bin/env bash
# Cut a release from the tip of main: bump versions, commit, tag, push.
# Usage: scripts/release.sh <version>   (e.g. scripts/release.sh 0.2.0)
#
# The push triggers the Release workflow, which re-runs the checks and
# publishes the GitHub release. Requires push access to main (the repo
# admin bypasses the branch ruleset).
set -euo pipefail

VERSION="${1:?usage: scripts/release.sh <version, e.g. 0.2.0>}"
VERSION="${VERSION#v}"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: invalid semver: $VERSION" >&2
  exit 1
fi
TAG="v$VERSION"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "error: releases are cut from main (current branch: $branch)" >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: working tree is not clean" >&2
  exit 1
fi

git fetch origin main --tags
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "error: main is not in sync with origin/main" >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "error: tag $TAG already exists" >&2
  exit 1
fi

# node edits keep this portable across BSD/GNU sed.
node -e '
  const fs = require("node:fs");
  const version = process.argv[1];
  const toml = fs.readFileSync("herdr-plugin.toml", "utf8");
  fs.writeFileSync(
    "herdr-plugin.toml",
    toml.replace(/^version = ".*"$/m, `version = "${version}"`),
  );
' "$VERSION"
npm version "$VERSION" --no-git-tag-version

npm ci
scripts/checks.sh --strict

git add herdr-plugin.toml package.json package-lock.json
git commit -m "chore(release): $TAG"
git tag "$TAG"
git push --atomic origin main "refs/tags/$TAG"

echo "pushed $TAG — the Release workflow will publish the GitHub release"
