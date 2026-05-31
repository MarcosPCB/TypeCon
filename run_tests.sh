#!/usr/bin/env bash
# TypeCON test runner — compile, link, and validate every template.
# Usage:
#   ./run_tests.sh          # run all tests (assumes dist/ is current)
#   ./run_tests.sh --build  # run yarn build first

set -uo pipefail

# ── colours ────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_RESET='\033[0m'; C_GREEN='\033[0;32m'; C_RED='\033[0;31m'
  C_YELLOW='\033[0;33m'; C_CYAN='\033[0;36m'; C_BOLD='\033[1m'
else
  C_RESET=''; C_GREEN=''; C_RED=''; C_YELLOW=''; C_CYAN=''; C_BOLD=''
fi

PASS=0
FAIL=0
SKIP=0

# ── helpers ─────────────────────────────────────────────────────────────────────
strip_ansi() { sed 's/\x1B\[[0-9;]*[mK]//g'; }

has_error() { grep -q '\[ERROR\]' <(echo "$1" | strip_ansi); }

run_test() {
  local src="$1"
  local name
  name=$(basename "$src" .ts)
  local con="compiled/${name}.con"

  printf "  %-40s " "${name}.ts"

  # 1 — compile
  local out
  out=$(node dist/main.js -c -il "$src" 2>&1)
  if has_error "$out"; then
    printf "${C_RED}FAIL${C_RESET} (compile)\n"
    echo "$out" | strip_ansi | grep '\[ERROR\]' | sed 's/^/    /'
    FAIL=$((FAIL + 1))
    return
  fi

  # 2 — link
  out=$(node dist/main.js -L -di 2>&1)
  if has_error "$out"; then
    printf "${C_RED}FAIL${C_RESET} (link)\n"
    echo "$out" | strip_ansi | grep '\[ERROR\]' | sed 's/^/    /'
    FAIL=$((FAIL + 1))
    return
  fi

  # 3 — validate
  out=$(node dist/main.js -V -i "$con" 2>&1)
  if has_error "$out"; then
    printf "${C_RED}FAIL${C_RESET} (validate)\n"
    echo "$out" | strip_ansi | grep '\[ERROR\]' | sed 's/^/    /'
    FAIL=$((FAIL + 1))
    return
  fi

  printf "${C_GREEN}PASS${C_RESET}\n"
  PASS=$((PASS + 1))
}

# ── optional build ──────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--build" ]]; then
  printf "${C_BOLD}Building...${C_RESET}\n"
  if ! yarn build 2>&1; then
    printf "${C_RED}Build failed — aborting.${C_RESET}\n"
    exit 1
  fi
  echo ""
fi

# ── test groups ─────────────────────────────────────────────────────────────────
printf "${C_BOLD}${C_CYAN}=== Actors ===${C_RESET}\n"
run_test templates/actors/AssaultTrooper.ts
run_test templates/actors/BattleLord.ts

printf "\n${C_BOLD}${C_CYAN}=== General ===${C_RESET}\n"
run_test templates/tests/general/test.ts

printf "\n${C_BOLD}${C_CYAN}=== Events ===${C_RESET}\n"
run_test templates/tests/events/test_events.ts

printf "\n${C_BOLD}${C_CYAN}=== Input ===${C_RESET}\n"
run_test templates/tests/input/test_cinput.ts
run_test templates/tests/input/test_input.ts

printf "\n${C_BOLD}${C_CYAN}=== JSON ===${C_RESET}\n"
run_test templates/tests/json/test_json.ts
run_test templates/tests/json/test_json_alias.ts
run_test templates/tests/json/test_json_alias2.ts
run_test templates/tests/json/test_record.ts

printf "\n${C_BOLD}${C_CYAN}=== Math ===${C_RESET}\n"
run_test templates/tests/math/test_anim.ts
run_test templates/tests/math/test_fp.ts
run_test templates/tests/math/test_math.ts

printf "\n${C_BOLD}${C_CYAN}=== Singletons ===${C_RESET}\n"
run_test templates/tests/singletons/test_player_singleton.ts
run_test templates/tests/singletons/test_singleton.ts

printf "\n${C_BOLD}${C_CYAN}=== Structs ===${C_RESET}\n"
run_test templates/tests/structs/test_paldata.ts
run_test templates/tests/structs/test_players.ts
run_test templates/tests/structs/test_projectiles.ts
run_test templates/tests/structs/test_sectors.ts
run_test templates/tests/structs/test_sprites.ts
run_test templates/tests/structs/test_tiledata.ts
run_test templates/tests/structs/test_tsprites.ts
run_test templates/tests/structs/test_userdef.ts

# ── summary ─────────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
printf "\n${C_BOLD}─────────────────────────────────────────────────\n"
printf "Results: ${C_GREEN}${PASS} passed${C_RESET}${C_BOLD}, ${C_RED}${FAIL} failed${C_RESET}${C_BOLD} / ${TOTAL} total${C_RESET}\n"

out=$(node dist/main.js -C 2>&1)

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
