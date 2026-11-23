#!/usr/bin/env bash
# Jalankan static test + unit test frontend & backend, simpan log mentah dan ringkasan Markdown.
# Pakai: bash scripts/test-report.sh   (dari root repo)
# Hasil: docs/testing/results/<tanggal_jam>/summary.md + *.log

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$ROOT/docs/testing/results/$STAMP"
mkdir -p "$OUT"

export CI=1 FORCE_COLOR=0 NO_COLOR=1
ROWS=()
FAILED=0

strip_ansi() { sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g'; }

# run <nama-log> <folder> <judul> <perintah...>
run() {
  local name="$1" dir="$2" title="$3"
  shift 3
  local log="$OUT/$name.log" start end code
  echo "▶ $title"
  start=$(date +%s)
  {
    echo "\$ cd $dir && $*"
    echo
  } > "$log"
  (cd "$ROOT/$dir" && "$@") 2>&1 | strip_ansi >> "$log"
  code=${PIPESTATUS[0]}
  end=$(date +%s)
  echo >> "$log"
  echo "exit code: $code, durasi: $((end - start)) detik" >> "$log"
  [ "$code" -eq 0 ] && status="✅ Lolos" || { status="❌ Gagal"; FAILED=$((FAILED + 1)); }
  ROWS+=("| $title | $status | $(detail "$name" "$log") | $((end - start)) dtk | [$name.log]($name.log) |")
}

# Ambil angka penting dari log untuk kolom "Detail".
detail() {
  local name="$1" log="$2"
  case "$name" in
    *jest*) grep -E '^Tests:' "$log" | tail -1 | sed 's/Tests: *//' ;;
    *vitest*) grep -E '^ *Tests ' "$log" | tail -1 | sed -E 's/^ *Tests +//' ;;
    *lint*) grep -E '✖ [0-9]+ problems' "$log" | tail -1 | sed 's/✖ //' || true ;;
    *typecheck*) n=$(grep -cE 'error TS[0-9]+' "$log"); echo "$n error" ;;
    *prisma-validate*) grep -q 'is valid' "$log" && echo "skema valid" || echo "lihat log" ;;
    *) echo "" ;;
  esac
}

echo "Hasil disimpan di $OUT"

# Persiapan backend: Prisma Client harus ada sebelum typecheck.
(cd "$ROOT/backend" && npx prisma generate) > "$OUT/backend-prisma-generate.log" 2>&1

run frontend-lint      frontend "Frontend · ESLint (static)"        npm run lint
run frontend-typecheck frontend "Frontend · TypeScript (static)"    npm run typecheck
run frontend-jest      frontend "Frontend · Jest (unit)"            npx jest --ci --json --outputFile="$OUT/frontend-jest.json"
# Reporter bawaan Jest tidak mencetak nama test saat output bukan terminal; tulis daftarnya dari JSON.
node -e '
const r = require(process.argv[1]);
const lines = ["", "Daftar test:"];
for (const s of r.testResults) {
  const file = s.name.split(process.argv[2]).pop().split(String.fromCharCode(92)).join("/");
  lines.push("", (s.status === "passed" ? "PASS " : "FAIL ") + file);
  for (const a of s.assertionResults) {
    lines.push("  " + (a.status === "passed" ? "✓" : "✕") + " " + [...a.ancestorTitles, a.title].join(" > "));
    for (const m of a.failureMessages) lines.push("      " + m.split("\n")[0]);
  }
}
console.log(lines.join("\n"));
' "$OUT/frontend-jest.json" "mangan_yuk" >> "$OUT/frontend-jest.log"
run backend-typecheck  backend  "Backend · TypeScript (static)"     npm run typecheck
run backend-prisma-validate backend "Backend · Prisma validate (static)" npx prisma validate
run backend-vitest     backend  "Backend · Vitest (unit)"           npx vitest run --reporter=verbose

BRANCH="$(git -C "$ROOT" branch --show-current)"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD)"
DIRTY="$(git -C "$ROOT" status --porcelain | grep -q . && echo ' (ada perubahan belum di-commit)' || true)"

{
  echo "# Hasil Static & Unit Test"
  echo
  echo "- Waktu: $(date '+%Y-%m-%d %H:%M')"
  echo "- Branch: \`$BRANCH\`, commit \`$COMMIT\`$DIRTY"
  echo "- Mesin: $(uname -s), Node $(node -v)"
  echo
  echo "| Pemeriksaan | Status | Detail | Durasi | Log |"
  echo "|---|---|---|---|---|"
  printf '%s\n' "${ROWS[@]}"
  echo
  if [ "$FAILED" -eq 0 ]; then
    echo "Semua pemeriksaan lolos."
  else
    echo "$FAILED pemeriksaan gagal. Lihat log terkait untuk rinciannya."
  fi
  echo
  echo "## Daftar test yang gagal"
  echo
  fails="$(grep -hE '^\s*(✕|×|●) ' "$OUT"/frontend-jest.log "$OUT"/backend-vitest.log 2>/dev/null | sed -E 's/^\s+//' | sort -u)"
  if [ -n "$fails" ]; then echo '```'; echo "$fails"; echo '```'; else echo "Tidak ada."; fi
} > "$OUT/summary.md"

echo
cat "$OUT/summary.md"
exit "$FAILED"
