#!/usr/bin/env bash
# Governor Beslisblok 02 — rol-testfixtures aanmaken (alleen development/test/staging).
# Fail-closed: het onderliggende script weigert in productie.
set -euo pipefail
cd "$(dirname "$0")/../../artifacts/api-server"
DIST_DIR=dist-tests/governor-fixtures BUILD_ENTRIES=src/scripts/governor-role-fixtures.ts pnpm run build >/dev/null
ENTRY="$(find dist-tests/governor-fixtures -name 'governor-role-fixtures.mjs' | head -1)"
exec node --enable-source-maps "$ENTRY" create
