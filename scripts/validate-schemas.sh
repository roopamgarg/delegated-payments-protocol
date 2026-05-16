#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to run schema validation"
  exit 1
fi

validate_suite() {
  local title="$1"
  local schema="$2"
  local examples_dir="$3"

  echo "== ${title} =="
  echo "Schema: ${schema}"

  local file
  for file in "${examples_dir}"/valid-*.json; do
    [[ -e "$file" ]] || continue
    echo "Expect valid: ${file}"
    npx --yes ajv-cli@5 validate -s "$schema" -d "$file" --spec=draft2020
  done

  for file in "${examples_dir}"/invalid-*.json; do
    [[ -e "$file" ]] || continue
    echo "Expect invalid: ${file}"
    if npx --yes ajv-cli@5 validate -s "$schema" -d "$file" --spec=draft2020 2>/dev/null; then
      echo "::error::Expected ${file} to fail validation"
      exit 1
    fi
  done
}

validate_suite \
  "Capability tokens" \
  "${ROOT}/specs/schemas/capability-token.schema.json" \
  "${ROOT}/sdk/examples/capability-tokens"

validate_suite \
  "Payment intents" \
  "${ROOT}/specs/schemas/payment-intent.schema.json" \
  "${ROOT}/sdk/examples/payment-intents"

validate_suite \
  "Mandates" \
  "${ROOT}/specs/schemas/mandate.schema.json" \
  "${ROOT}/sdk/examples/mandates"

echo "All JSON schema example suites passed"
