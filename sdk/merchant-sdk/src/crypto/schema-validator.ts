import type { ValidateFunction, ErrorObject } from 'ajv';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DPPError } from '../errors.js';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020') as new (opts?: {
  allErrors?: boolean;
  strict?: boolean;
}) => {
  compile(schema: object): ValidateFunction;
};

/** JWT registered claims that are not part of the DPP capability JSON Schema. */
const JWT_CLAIMS_EXCLUDED_FROM_SCHEMA = new Set(['iat', 'jti']);

let compiledValidator: ValidateFunction | undefined;

function loadCapabilitySchema(): object {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../../schemas/capability-token.schema.json'),
    join(here, '../../../../specs/schemas/capability-token.schema.json'),
  ];
  for (const path of candidates) {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as object;
    } catch {
      // try next
    }
  }
  throw new DPPError('invalid_token', 'Capability token JSON Schema is unavailable');
}

function getValidator(): ValidateFunction {
  if (compiledValidator) {
    return compiledValidator;
  }
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validator = ajv.compile(loadCapabilitySchema());
  compiledValidator = validator;
  return validator;
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) {
    return 'Capability token payload failed schema validation';
  }
  return errors
    .map((e) => {
      const path = e.instancePath || '/';
      return `${path}: ${e.message ?? 'invalid'}`;
    })
    .join('; ');
}

/**
 * Validate capability claims against the normative v0.1 JSON Schema.
 * Never throws raw errors — only {@link DPPError} with code `invalid_token`.
 */
export function validateCapabilitySchema(payload: Record<string, unknown>): void {
  const forSchema: Record<string, unknown> = { ...payload };
  for (const claim of JWT_CLAIMS_EXCLUDED_FROM_SCHEMA) {
    delete forSchema[claim];
  }

  let validate: ValidateFunction;
  try {
    validate = getValidator();
  } catch (err) {
    if (err instanceof DPPError) {
      throw err;
    }
    throw new DPPError(
      'invalid_token',
      err instanceof Error ? err.message : 'Schema validator initialization failed',
    );
  }

  try {
    if (validate(forSchema)) {
      return;
    }
    throw new DPPError('invalid_token', formatSchemaErrors(validate.errors), {
      schemaErrors: validate.errors ?? [],
    });
  } catch (err) {
    if (err instanceof DPPError) {
      throw err;
    }
    throw new DPPError(
      'invalid_token',
      err instanceof Error ? err.message : 'Capability token schema validation failed',
    );
  }
}
