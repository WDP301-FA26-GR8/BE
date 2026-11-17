import { ConfigService } from '@nestjs/config';
import type { MongoClient, MongoClientOptions } from 'mongodb';
import { EnvironmentValidationError } from '../config/environment-validation';
import { MongoConnection } from './mongodb-connection.service';
import { MONGO_RUNTIME_ADAPTERS, createMongoConnection, mongoClientOptions } from './mongodb-infrastructure.module';

/** Made-up values for this spec. */
const SECRET = 'mongo-spec-password';
const config = (values: Record<string, string>) => new ConfigService(values);

describe('MongoInfrastructureModule', () => {
  it('validates when mounted, so a production mount without credentials fails to boot (MI-06)', () => {
    const createClient = jest.fn();

    expect(() =>
      createMongoConnection(
        config({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://mongodb.internal:27017' }),
        createClient,
      ),
    ).toThrow(EnvironmentValidationError);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('builds one client with the configured pool and timeouts and does not connect it (MI-07)', () => {
    const client = { db: jest.fn(), close: jest.fn(), connect: jest.fn() };
    const createClient = jest.fn<MongoClient, [string, MongoClientOptions]>(() => client as unknown as MongoClient);

    const connection = createMongoConnection(
      config({
        NODE_ENV: 'production',
        MONGODB_URI: `mongodb://history:${SECRET}@mongodb.internal:27017`,
        MONGODB_DATABASE: 'history_spec',
        MONGODB_MAX_POOL_SIZE: '7',
        MONGODB_SERVER_SELECTION_TIMEOUT_MS: '1500',
        MONGODB_OPERATION_TIMEOUT_MS: '2500',
      }),
      createClient,
    );

    expect(connection).toBeInstanceOf(MongoConnection);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(`mongodb://history:${SECRET}@mongodb.internal:27017`, {
      appName: 'software-license-management',
      maxPoolSize: 7,
      serverSelectionTimeoutMS: 1_500,
      connectTimeoutMS: 2_500,
      socketTimeoutMS: 2_500,
      waitQueueTimeoutMS: 2_500,
      runtimeAdapters: MONGO_RUNTIME_ADAPTERS,
    });
    expect(client.connect).not.toHaveBeenCalled();
    connection.database();
    expect(client.db).toHaveBeenCalledWith('history_spec');
  });

  it('builds the real driver client from the development defaults without touching the network', async () => {
    const connection = createMongoConnection(config({ NODE_ENV: 'development' }));

    expect(connection.database().databaseName).toBe('slm_ai_history');
    await connection.onApplicationShutdown();
  });

  it('reports a URI the driver cannot parse by its key only', () => {
    const createClient = jest.fn(() => {
      throw new Error(`could not parse mongodb://history:${SECRET}@`);
    });

    let message = '';
    try {
      createMongoConnection(
        config({ NODE_ENV: 'development', MONGODB_URI: `mongodb://history:${SECRET}@` }),
        createClient,
      );
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe('Environment validation failed: MONGODB_URI is not a valid connection string');
  });

  it('hands the driver the os module, so it never loads it by dynamic import (refused inside a vm such as Jest)', () => {
    const options = mongoClientOptions({
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      MONGODB_DATABASE: 'slm_ai_history',
      MONGODB_MAX_POOL_SIZE: 5,
      MONGODB_SERVER_SELECTION_TIMEOUT_MS: 2_000,
      MONGODB_OPERATION_TIMEOUT_MS: 3_000,
    });

    expect(options.runtimeAdapters?.os?.platform()).toBe(process.platform);
  });

  it('never passes timeoutMS, which driver 7 deprecates and ignores', () => {
    const options = mongoClientOptions({
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      MONGODB_DATABASE: 'slm_ai_history',
      MONGODB_MAX_POOL_SIZE: 5,
      MONGODB_SERVER_SELECTION_TIMEOUT_MS: 2_000,
      MONGODB_OPERATION_TIMEOUT_MS: 3_000,
    });

    expect(options).not.toHaveProperty('timeoutMS');
  });

  it('maps the settings to driver options', () => {
    expect(
      mongoClientOptions({
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DATABASE: 'slm_ai_history',
        MONGODB_MAX_POOL_SIZE: 5,
        MONGODB_SERVER_SELECTION_TIMEOUT_MS: 2_000,
        MONGODB_OPERATION_TIMEOUT_MS: 3_000,
      }),
    ).toEqual({
      appName: 'software-license-management',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 2_000,
      connectTimeoutMS: 3_000,
      socketTimeoutMS: 3_000,
      waitQueueTimeoutMS: 3_000,
      runtimeAdapters: MONGO_RUNTIME_ADAPTERS,
    });
  });
});
