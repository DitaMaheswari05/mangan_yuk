#!/usr/bin/env bash
# Generate tipe TypeScript dari skema DB lokal → frontend/src/types/database.types.ts
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=../frontend/src/types/database.types.ts
{
  echo "// ⚙️ DI-GENERATE dari backend (backend/scripts/gen-types.sh). JANGAN DIEDIT MANUAL."
  npx supabase gen types typescript --local
} > "$OUT"
echo "Tipe ditulis ke $OUT"
