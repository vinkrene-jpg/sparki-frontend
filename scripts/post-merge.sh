#!/bin/bash
set -e
pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
pnpm --filter db push
