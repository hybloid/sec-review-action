#!/usr/bin/env bash
# Fetch the latest (including draft) release JAR from a private GitHub repo and save it as tool/analysis.jar
#
# Usage:
#   bash tool/fetch-latest-jar-macos.sh <PAT> [owner/repo]
#
# Example:
#   bash tool/fetch-latest-jar-macos.sh ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx hybloid/hktn25-sec-review
#
# Notes:
# - Requires: curl, jq
# - Defaults to repository: hybloid/hktn25-sec-review
# - Works on macOS (tested with the same logic as the CI workflow)

set -euo pipefail

if [ "${1-}" = "" ]; then
  echo "Error: Missing required argument: PAT (Personal Access Token)" >&2
  echo "Usage: bash tool/fetch-latest-jar-macos.sh <PAT> [owner/repo]" >&2
  exit 1
fi

PAT="$1"
TARGET_REPO="${2:-hybloid/hktn25-sec-review}"

# Dependencies check
for dep in curl jq; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    echo "Error: Required dependency '$dep' not found. Please install it (e.g., brew install $dep)." >&2
    exit 1
  fi
done

mkdir -p "tool"

API_BASE="https://api.github.com"
AUTH_HEADER=( -H "Authorization: token ${PAT}" )
JSON_HEADER=( -H "Accept: application/vnd.github+json" )

# Fetch newest release (includes drafts when authenticated)
echo "Fetching the latest release (including drafts) from ${TARGET_REPO}..."
releases_json=$(curl -sSf "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  "${API_BASE}/repos/${TARGET_REPO}/releases?per_page=1")

release_id=$(echo "$releases_json" | jq -r '.[0].id')
if [ -z "$release_id" ] || [ "$release_id" = "null" ]; then
  echo "No releases found in ${TARGET_REPO}" >&2
  exit 1
fi

# List assets and select any JAR by content_type or .jar suffix
echo "Looking for a JAR asset in release id ${release_id}..."
assets=$(curl -sSf "${AUTH_HEADER[@]}" "${JSON_HEADER[@]}" \
  "${API_BASE}/repos/${TARGET_REPO}/releases/${release_id}/assets")

asset_id=$(echo "$assets" | jq -r '([.[] | select((.content_type == "application/java-archive") or (.name | test("\\.jar$")))][0].id // empty)')

if [ -z "$asset_id" ]; then
  echo "No JAR asset found in the latest release of ${TARGET_REPO}" >&2
  echo "Available assets:" >&2
  echo "$assets" | jq -r '.[].name' >&2 || true
  exit 1
fi

# Download asset (must use the asset API with octet-stream accept)
echo "Downloading asset id ${asset_id} to tool/analysis.jar ..."
curl -sSfL "${AUTH_HEADER[@]}" -H "Accept: application/octet-stream" \
  -o tool/analysis.jar \
  "${API_BASE}/repos/${TARGET_REPO}/releases/assets/${asset_id}"

# Verify file
if [ ! -s tool/analysis.jar ]; then
  echo "Downloaded analysis.jar is empty or missing" >&2
  exit 1
fi

echo "Success: Saved JAR as tool/analysis.jar"
