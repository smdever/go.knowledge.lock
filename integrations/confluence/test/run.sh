#!/usr/bin/env bash
# Builds the tests with Forge's packages swapped for local fakes, then runs them.
# Integration tests need a local Knowledge Lock server; set KL_TEST_BASE, KL_TEST_SETUP and KL_TEST_COOKIE.
set -euo pipefail
cd "$(dirname "$0")/.."
out=$(mktemp -d)
npx -y esbuild@0.25.0 test/unit.test.ts --bundle --platform=node --outfile="$out/unit.cjs" --log-level=warning
node --test "$out/unit.cjs"
if [ -n "${KL_TEST_SETUP:-}" ]; then
  npx -y esbuild@0.25.0 test/resolvers.test.ts --bundle --platform=node --outfile="$out/resolvers.cjs" --log-level=warning \
    --alias:@forge/api=./test/mocks/forge-api.ts --alias:@forge/kvs=./test/mocks/forge-kvs.ts
  node --test --test-concurrency=1 "$out/resolvers.cjs"
fi
