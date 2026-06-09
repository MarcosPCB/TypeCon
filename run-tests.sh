#!/usr/bin/env bash
# TypeCON test runner
# Usage:
#   ./run-tests.sh          # run all tests (assumes dist/ is current)
#   ./run-tests.sh --build  # run yarn build first

set -uo pipefail

# ── colours ────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  R='\033[0m'; GRN='\033[0;32m'; RED='\033[0;31m'
  CYN='\033[0;36m'; BLD='\033[1m'
else
  R=''; GRN=''; RED=''; CYN=''; BLD=''
fi

PASS=0; FAIL=0

strip_ansi() { sed 's/\x1B\[[0-9;]*[mK]//g'; }
has_error()  { grep -q '\[ERROR\]' <(echo "$1" | strip_ansi); }

clean() { node dist/main.js -C > /dev/null 2>&1 || true; }

# ── shared compile + link (cleans obj/ first to isolate each test) ────────────
_compile_link() {
  local src="$1" name="$2" out

  clean

  out=$(node dist/main.js -c -il "$src" 2>&1)
  if has_error "$out"; then
    printf "${RED}FAIL${R} (compile)\n"
    echo "$out" | strip_ansi | grep '\[ERROR\]' | sed 's/^/    /'
    FAIL=$((FAIL + 1)); return 1
  fi

  out=$(node dist/main.js -L -di 2>&1)
  if has_error "$out"; then
    printf "${RED}FAIL${R} (link)\n"
    echo "$out" | strip_ansi | grep '\[ERROR\]' | sed 's/^/    /'
    FAIL=$((FAIL + 1)); return 1
  fi
}

# ── runner: compile + link + simulate --test ──────────────────────────────────
run_test_sim() {
  local src="$1"
  local name; name=$(basename "$src" .ts)
  local con="compiled/${name}.con"

  printf "  %-42s " "${name}.ts"
  _compile_link "$src" "$name" || return

  local out sim_exit
  out=$(node dist/main.js -S --test -nv -i "$con" 2>&1)
  sim_exit=$?

  local summary
  summary=$(echo "$out" | strip_ansi \
    | grep -E "All [0-9]+ test|[0-9]+/[0-9]+ passed" \
    | sed 's/^ *//' | head -1)

  if [ "$sim_exit" -ne 0 ]; then
    printf "${RED}FAIL${R} (sim)  ${summary}\n"
    FAIL=$((FAIL + 1))
  else
    printf "${GRN}PASS${R} (sim)  ${summary}\n"
    PASS=$((PASS + 1))
  fi
}

# ── runner: compile + link + validate ────────────────────────────────────────
run_test() {
  local src="$1"
  local name; name=$(basename "$src" .ts)
  local con="compiled/${name}.con"

  printf "  %-42s " "${name}.ts"
  _compile_link "$src" "$name" || return

  local out
  out=$(node dist/main.js -V -i "$con" 2>&1)
  if has_error "$out"; then
    printf "${RED}FAIL${R} (validate)\n"
    echo "$out" | strip_ansi | grep '\[ERROR\]' | sed 's/^/    /'
    FAIL=$((FAIL + 1)); return
  fi

  printf "${GRN}PASS${R} (validate)\n"
  PASS=$((PASS + 1))
}

# ── optional build ────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--build" ]]; then
  printf "${BLD}Building...${R}\n"
  if ! yarn build 2>&1; then
    printf "${RED}Build failed — aborting.${R}\n"; exit 1
  fi
  echo ""
fi

# ── test groups ───────────────────────────────────────────────────────────────
printf "${BLD}${CYN}=== Actors ===${R}\n"
run_test examples/actors/AssaultTrooper.ts
run_test examples/actors/BattleLord.ts

printf "\n${BLD}${CYN}=== General ===${R}\n"
run_test examples/general/test.ts

printf "\n${BLD}${CYN}=== Events ===${R}\n"
run_test examples/tests/events/test_events.ts

printf "\n${BLD}${CYN}=== Input ===${R}\n"
run_test examples/tests/input/test_cinput.ts
run_test examples/tests/input/test_input.ts

printf "\n${BLD}${CYN}=== JSON ===${R}\n"
run_test_sim examples/tests/json/test_json.ts
run_test_sim examples/tests/json/test_json_alias.ts
run_test_sim examples/tests/json/test_json_alias2.ts
run_test_sim examples/tests/json/test_record.ts
run_test_sim examples/tests/json/test_file_json.ts
run_test_sim examples/tests/json/test_file_json_record.ts

printf "\n${BLD}${CYN}=== Math ===${R}\n"
run_test_sim examples/tests/math/test_anim.ts
run_test_sim examples/tests/math/test_fp.ts
run_test_sim examples/tests/math/test_math.ts

printf "\n${BLD}${CYN}=== Singletons ===${R}\n"
run_test examples/tests/singletons/test_player_singleton.ts
run_test examples/tests/singletons/test_singleton.ts

printf "\n${BLD}${CYN}=== Structs ===${R}\n"
run_test examples/tests/structs/test_paldata.ts
run_test examples/tests/structs/test_players.ts
run_test examples/tests/structs/test_projectiles.ts
run_test examples/tests/structs/test_sectors.ts
run_test examples/tests/structs/test_sprites.ts
run_test examples/tests/structs/test_tiledata.ts
run_test examples/tests/structs/test_tsprites.ts
run_test examples/tests/structs/test_userdef.ts

# ── summary ───────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
printf "\n${BLD}─────────────────────────────────────────────────${R}\n"
printf "Results: ${GRN}${PASS} passed${R}, ${RED}${FAIL} failed${R} / ${TOTAL} total\n"

clean

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
