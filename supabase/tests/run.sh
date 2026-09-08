#!/usr/bin/env bash
#
# Applies schema.sql to a throwaway database and checks that the row level
# security policies actually hold, by having one user try to read and modify
# another's habits.
#
# Needs a local Postgres you can create databases on:
#
#   ./supabase/tests/run.sh
#   PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./supabase/tests/run.sh
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
db="habit_tracker_rls_test_$$"

psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database \"$db\";"
trap 'psql -q -d postgres -c "drop database if exists \"$db\";" >/dev/null 2>&1' EXIT

# The "already exists / does not exist, skipping" notices are just schema.sql's
# idempotency guards talking; they are noise here.
run() { PGOPTIONS='-c client_min_messages=warning' psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$1"; }

run "$here/setup.sql"
run "$here/../schema.sql"
run "$here/../schema.sql"   # applying twice must be a no-op

psql -v ON_ERROR_STOP=1 -d "$db" -f "$here/rls.sql" 2>&1 \
  | grep -E 'PASS|FAIL|ERROR|ALL DATABASE' \
  | sed 's/^psql.*NOTICE:  //'
