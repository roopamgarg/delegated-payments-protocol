#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA="${ROOT}/specs/schemas/capability-token.schema.json"
VALID_DIR="${ROOT}/sdk/examples/capability-tokens"
INVALID_DIR="${VALID_DIR}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to run schema validation"
  exit 1
fi

validate() {
  local file="$1"
  npx --yes ajv-cli@5 validate -s "$SCHEMA" -d "$file" --spec=draft2020
}

echo "Schema: ${SCHEMA}"

for file in "${VALID_DIR}"/valid-*.json; do
  echo "Expect valid: ${file}"
  validate "$file"
done

for file in "${INVALID_DIR}"/invalid-*.json; do
  echo "Expect invalid: ${file}"
  if validate "$file" 2>/dev/null; then
    echo "::error::Expected ${file} to fail validation"
    exit 1
  fi
done

echo "All capability token examples passed schema checks"
