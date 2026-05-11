#!/usr/bin/env bash
#
# Sync Apps Script .js source between the prod and stage libraries.
#
#   appscript-library/       <-> prod   (scriptId in its .clasp.json)
#   appscript-library-stage/ <-> stage  (scriptId in its .clasp.json)
#
# Usage:
#   scripts/sync-stage.sh diff        Show a unified diff of the two trees (no changes).
#   scripts/sync-stage.sh to-stage    Copy prod *.js -> stage, then optionally clasp push stage.
#   scripts/sync-stage.sh to-prod     Copy stage *.js -> prod,  then optionally clasp push prod.
#
# Notes:
#   - Only *.js files are touched. .clasp.json and appsscript.json are env-specific
#     and are NEVER copied between trees.
#   - A diff is always shown and confirmation required before any file is written.
#   - Files that exist in the destination but NOT in the source are deleted, so
#     renames/removals propagate. Confirm carefully.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROD_DIR="$ROOT/appscript-library"
STAGE_DIR="$ROOT/appscript-library-stage"

color() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
bold()  { color '1'   "$1"; }
green() { color '32'  "$1"; }
yellow(){ color '33'  "$1"; }
red()   { color '31'  "$1"; }

usage() {
  cat <<EOF
$(bold "sync-stage.sh") — sync Apps Script source between prod and stage

Usage:
  scripts/sync-stage.sh diff        Show diff between prod and stage (read-only)
  scripts/sync-stage.sh to-stage    Copy prod *.js  ->  stage  (then optional clasp push)
  scripts/sync-stage.sh to-prod     Copy stage *.js ->  prod   (then optional clasp push)

Files NEVER copied: .clasp.json, appsscript.json
EOF
}

require_dirs() {
  if [ ! -d "$PROD_DIR" ]; then
    echo "$(red "Missing prod dir:") $PROD_DIR" >&2
    exit 1
  fi
  if [ ! -d "$STAGE_DIR" ]; then
    echo "$(red "Missing stage dir:") $STAGE_DIR" >&2
    exit 1
  fi
}

show_diff() {
  local from="$1" to="$2"
  diff -ruN \
    --exclude='.clasp.json' \
    --exclude='appsscript.json' \
    --exclude='node_modules' \
    "$from" "$to" || true
}

sync_files() {
  local src="$1" dst="$2"
  if ! command -v rsync >/dev/null 2>&1; then
    echo "$(red "rsync is required but not installed.")" >&2
    exit 1
  fi
  rsync -av --delete-after \
    --include='*.js' \
    --exclude='*' \
    "$src"/ "$dst"/
}

confirm() {
  local prompt="$1"
  local ans
  read -r -p "$prompt [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]]
}

clasp_push() {
  local dir="$1" label="$2"
  if ! command -v clasp >/dev/null 2>&1; then
    echo "$(yellow "clasp not installed, skipping push.")"
    return
  fi
  echo "$(bold "Running clasp push in $label ($dir)...")"
  ( cd "$dir" && clasp push -f )
}

direction="${1:-}"

case "$direction" in
  ""|-h|--help|help)
    usage
    exit 0
    ;;

  diff)
    require_dirs
    echo "$(bold "Diff: prod (left) vs stage (right)")"
    show_diff "$PROD_DIR" "$STAGE_DIR"
    ;;

  to-stage|to-prod)
    require_dirs
    if [ "$direction" = "to-stage" ]; then
      SRC="$PROD_DIR"; DST="$STAGE_DIR"
      SRC_LABEL="prod"; DST_LABEL="stage"
    else
      SRC="$STAGE_DIR"; DST="$PROD_DIR"
      SRC_LABEL="stage"; DST_LABEL="prod"
    fi

    echo "$(bold "Preview — applying $SRC_LABEL -> $DST_LABEL:")"
    echo "(- lines removed from $DST_LABEL,  + lines added to $DST_LABEL)"
    show_diff "$DST" "$SRC"
    echo

    if ! confirm "Apply these changes to $(bold "$DST_LABEL")?"; then
      echo "$(yellow "Aborted. No files changed.")"
      exit 0
    fi

    sync_files "$SRC" "$DST"
    echo "$(green "Files synced: $SRC_LABEL -> $DST_LABEL")"
    echo

    if confirm "Run $(bold "clasp push") for $DST_LABEL now?"; then
      clasp_push "$DST" "$DST_LABEL"
      echo "$(green "Pushed to $DST_LABEL Apps Script project.")"
      if [ "$DST_LABEL" = "prod" ]; then
        echo "$(yellow "Reminder:") prod Web App needs a new deployment if doPost changed."
        echo "  Apps Script editor -> Deploy -> Manage deployments -> Edit -> New version -> Deploy"
      fi
    else
      echo "Skipped clasp push. Run it later with:"
      echo "  cd $DST && clasp push"
    fi
    ;;

  *)
    echo "$(red "Unknown direction:") $direction" >&2
    usage
    exit 1
    ;;
esac
