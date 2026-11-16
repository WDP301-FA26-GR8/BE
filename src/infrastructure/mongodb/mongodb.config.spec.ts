import { EnvironmentValidationError } from '../config/environment-validation';
import { MONGO_ENVIRONMENT_KEYS, validateMongoEnvironment } from './mongodb.config';

/** Made-up values for this spec. */
const SECRET = 'mongo-spec-password';
const PRODUCTION = { NODE_ENV: 'production', MONGODB_URI: `mongodb://history:${SECRET}@mongodb.internal:27017` };

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof EnvironmentValidationError) return error.message;
    throw error;
  }
  throw new Error('expected an EnvironmentValidationError');
}

describe('MongoDB configuration (validated when MongoInfrastructureModule is mounted — ADR-0020)', () => {
  it('owns exactly the MONGODB_* keys', () => {
    expect([...MONGO_ENVIRONMENT_KEYS].sort()).toEqual(
      [
        'MONGODB_DATABASE',
        'MONGODB_MAX_POOL_SIZE',
        'MONGODB_OPERATION_TIMEOUT_MS',
        'MONGODB_SERVER_SELECTION_TIMEOUT_MS',
        'MONGODB_URI',
      ].sort(),
    );
  });

  it.each(['development', 'test'])(
    'runs against a local MongoDB with no credentials in %s (MI-01)',
    (nodeEnvironment) => {
      expect(validateMongoEnvironment({ NODE_ENV: nodeEnvironment })).toEqual({
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DATABASE: 'slm_ai_history',
        MONGODB_MAX_POOL_SIZE: 5,
        MONGODB_SERVER_SELECTION_TIMEOUT_MS: 2_000,
        MONGODB_OPERATION_TIMEOUT_MS: 3_000,
      });
    },
  );

  it('requires the URI in production (MI-02)', () => {
    expect(messageOf(() => validateMongoEnvironment({ NODE_ENV: 'production' }))).toContain(
      '"MONGODB_URI" is required',
    );
  });

  it.each([
    'mongodb://mongodb.internal:27017',
    'mongodb://history@mongodb.internal:27017',
    'mongodb+srv://cluster.example.net/slm',
  ])('refuses a production URI without a username and a password (MI-03): %s', (uri) => {
    const message = messageOf(() => validateMongoEnvironment({ ...PRODUCTION, MONGODB_URI: uri }));

    expect(message).toContain('MONGODB_URI must carry a username and a password in production');
    expect(message).not.toContain('mongodb.internal');
    expect(message).not.toContain('cluster.example.net');
  });

  it('accepts a production URI with credentials, mongodb+srv included', () => {
    expect(validateMongoEnvironment(PRODUCTION).MONGODB_URI).toBe(PRODUCTION.MONGODB_URI);
    expect(
      validateMongoEnvironment({ ...PRODUCTION, MONGODB_URI: `mongodb+srv://history:${SECRET}@cluster.example.net` })
        .MONGODB_URI,
    ).toContain('mongodb+srv://');
  });

  it.each([
    ['MONGODB_URI', `http://history:${SECRET}@mongodb.internal`, '"MONGODB_URI" must be a mongodb://'],
    ['MONGODB_DATABASE', 'slm.ai history', '"MONGODB_DATABASE" must be 1-63'],
    ['MONGODB_MAX_POOL_SIZE', '0', '"MONGODB_MAX_POOL_SIZE" must be greater than or equal to 1'],
    ['MONGODB_MAX_POOL_SIZE', '51', '"MONGODB_MAX_POOL_SIZE" must be less than or equal to 50'],
    ['MONGODB_SERVER_SELECTION_TIMEOUT_MS', '50', '"MONGODB_SERVER_SELECTION_TIMEOUT_MS" must be greater than'],
    ['MONGODB_OPERATION_TIMEOUT_MS', '60001', '"MONGODB_OPERATION_TIMEOUT_MS" must be less than'],
  ])('refuses %s = %s and names the key (MI-04)', (key, value, expected) => {
    expect(messageOf(() => validateMongoEnvironment({ NODE_ENV: 'development', [key]: value }))).toContain(expected);
  });

  it('never quotes the URI, its host or its password in a message (MI-05)', () => {
    const message = messageOf(() =>
      validateMongoEnvironment({ NODE_ENV: 'production', MONGODB_URI: `http://history:${SECRET}@mongodb.internal` }),
    );

    expect(message).not.toContain(SECRET);
    expect(message).not.toContain('mongodb.internal');
    expect(message).not.toContain('history:');
  });
});
