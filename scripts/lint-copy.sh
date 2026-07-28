#!/usr/bin/env bash
# Copy lint — blokkeert de verboden "Sparki als actor"-patronen in user-facing strings.
# Gebruik: pnpm run lint:copy  (of: bash scripts/lint-copy.sh)
#
# Slaat over: regels die uitsluitend code-commentaar zijn (// en * ...)
# Exit 0 = schoon | Exit 1 = één of meer overtredingen

set -euo pipefail

SEARCH_DIRS=(
  "artifacts/sparki/src"
  "artifacts/sparki-mobile/src"
  "packages"
)

PATTERNS=(
  "Sparki ziet"
  "Sparki denkt"
  "Sparki vindt"
  "Sparki bekijkt"
  "Sparki analyseert"
  "Sparki beoordeelt"
  "Sparki berekent"
  "Sparki herkent"
  "Sparki leert"
  "Sparki merkt"
  "Sparki schat"
  "Sparki vergelijkt"
  "Sparki volgt"
  "Sparki stelt voor"
  "Sparki bouwt"
  "Sparki maakt"
  "Sparki toont"
  "Sparki houdt"
  "Sparki gebruikt"
  "Sparki verwerkt"
  "Sparki kijkt"
  "Sparki bepaalt"
  "Sparki detecteert"
  "Sparki kiest"
  "Laat Sparki"
  "laat Sparki"
  "kan Sparki"
  "Sparki-advies"
  "Opgebouwd door Sparki"
  "door Sparki"
)

FOUND=0

for dir in "${SEARCH_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  for pattern in "${PATTERNS[@]}"; do
    # grep dan filter: sla regels over die puur commentaar zijn
    results=$(grep -rn "$pattern" "$dir" \
      --include="*.tsx" --include="*.ts" \
      | grep -v "\.test\." \
      | grep -v "\.spec\." \
      | grep -Ev "^\S+:[0-9]+:\s*(//|\*|/\*)" \
      2>/dev/null || true)
    if [ -n "$results" ]; then
      echo "❌  Verboden copy-patroon: \"$pattern\""
      echo "$results" | sed 's/^/   /'
      echo ""
      FOUND=1
    fi
  done
done

if [ "$FOUND" -eq 0 ]; then
  echo "✅  Copy lint geslaagd — geen verboden patronen gevonden."
  exit 0
else
  echo "────────────────────────────────────────────────────────"
  echo "Zie docs/COPY_DOCTRINE.md voor de schrijfregels en voorbeelden."
  exit 1
fi
