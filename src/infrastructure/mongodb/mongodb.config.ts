import type { ConfigService } from '@nestjs/config';
import Joi from 'joi';
import { EnvironmentValidationError, validateWithSchema } from '../config/environment-validation';

/** The MongoDB connection of the AI history store (MongoInfrastructureModule, ADR-0020). */
export interface MongoEnvironmentVariables {
  MONGODB_URI: string;
  MONGODB_DATABASE: string;
  MONGODB_MAX_POOL_SIZE: number;
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: number;
  MONGODB_OPERATION_TIMEOUT_MS: number;
}

const MONGODB_SCHEME = /^mongodb(?:\+srv)?:\/\/\S+$/;
/** `user:password@` before the first host: the URI carries its own credentials. */
const MONGODB_CREDENTIALS = /^mongodb(?:\+srv)?:\/\/[^:@/\s]+:[^@/\s]+@/;

export const mongoKeys = {
  // A URI can carry a password: every message below names the key, never the value (Joi quotes a value by default).
  MONGODB_URI: Joi.string()
    .pattern(MONGODB_SCHEME)
    .messages({ 'string.pattern.base': '{{#label}} must be a mongodb:// or mongodb+srv:// connection string' })
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('mongodb://127.0.0.1:27017'),
    }),
  MONGODB_DATABASE: Joi.string()
    .pattern(/^[A-Za-z0-9_-]{1,63}$/)
    .messages({ 'string.pattern.base': '{{#label}} must be 1-63 letters, digits, "_" or "-"' })
    .default('slm_ai_history'),
  MONGODB_MAX_POOL_SIZE: Joi.number().integer().min(1).max(50).default(5),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: Joi.number().integer().min(100).max(30_000).default(2_000),
  MONGODB_OPERATION_TIMEOUT_MS: Joi.number().integer().min(100).max(60_000).default(3_000),
};

export const MONGO_ENVIRONMENT_KEYS = Object.keys(mongoKeys) as (keyof MongoEnvironmentVariables)[];

export function assertProductionMongo(result: MongoEnvironmentVariables & { NODE_ENV: string }): void {
  if (result.NODE_ENV === 'production' && !MONGODB_CREDENTIALS.test(result.MONGODB_URI)) {
    throw new EnvironmentValidationError(
      'Environment validation failed: MONGODB_URI must carry a username and a password in production. ' +
        'MongoDB holds the prompts and raw answers of the AI calls, so an unauthenticated instance is readable by anything ' +
        'that reaches its network.',
    );
  }
}

const mongoSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  ...mongoKeys,
}).unknown(true);

/**
 * MongoDB's own validation, run when MongoInfrastructureModule is mounted: the shared API and worker schema does not carry
 * these keys, so only a process that mounts the module (today the ones `ai-assist` runs in, ADR-0020) gets the strict
 * production rules.
 */
export function validateMongoEnvironment(input: Record<string, unknown>): MongoEnvironmentVariables {
  const result = validateWithSchema(mongoSchema, input) as MongoEnvironmentVariables & { NODE_ENV: string };
  assertProductionMongo(result);

  return {
    MONGODB_URI: result.MONGODB_URI,
    MONGODB_DATABASE: result.MONGODB_DATABASE,
    MONGODB_MAX_POOL_SIZE: result.MONGODB_MAX_POOL_SIZE,
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: result.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    MONGODB_OPERATION_TIMEOUT_MS: result.MONGODB_OPERATION_TIMEOUT_MS,
  };
}

/** Reads and validates the MongoDB settings from the loaded configuration; the module factory calls it when mounted. */
export function mongoEnvironmentFrom(config: ConfigService): MongoEnvironmentVariables {
  return validateMongoEnvironment(
    Object.fromEntries(['NODE_ENV', ...MONGO_ENVIRONMENT_KEYS].map((key) => [key, config.get(key)])),
  );
}
