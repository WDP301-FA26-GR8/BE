import * as os from 'node:os';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, type MongoClientOptions } from 'mongodb';
import { EnvironmentValidationError } from '../config/environment-validation';
import { MongoConnection } from './mongodb-connection.service';
import { type MongoEnvironmentVariables, mongoEnvironmentFrom } from './mongodb.config';

/** Names this process in the server's logs and `currentOp`, nothing more. */
const APP_NAME = 'software-license-management';

/**
 * The `os` module, handed to the driver. Without it driver 7 loads `os` by dynamic `import()`, which a `vm` context
 * (Jest) refuses; the driver then sends an empty client metadata document and the server rejects the handshake
 * ("Missing required sub-document 'driver'"). Handing it over makes the client behave the same everywhere.
 */
export const MONGO_RUNTIME_ADAPTERS = { os } satisfies MongoClientOptions['runtimeAdapters'];

/**
 * The driver options of the one client of a process, from the validated settings. Driver 7 has no client-wide operation
 * deadline (`timeoutMS` is deprecated there and has no effect), so the operation timeout bounds every wait the client
 * controls: opening a connection, one send or receive on the socket, and waiting for a free connection of the pool. A
 * query that needs a server-side limit sets `maxTimeMS` itself.
 */
export function mongoClientOptions(settings: MongoEnvironmentVariables): MongoClientOptions {
  return {
    appName: APP_NAME,
    maxPoolSize: settings.MONGODB_MAX_POOL_SIZE,
    serverSelectionTimeoutMS: settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: settings.MONGODB_OPERATION_TIMEOUT_MS,
    socketTimeoutMS: settings.MONGODB_OPERATION_TIMEOUT_MS,
    waitQueueTimeoutMS: settings.MONGODB_OPERATION_TIMEOUT_MS,
    runtimeAdapters: MONGO_RUNTIME_ADAPTERS,
  };
}

/** Builds the connection when the module is mounted; `createClient` is replaced only by specs. */
export function createMongoConnection(
  config: ConfigService,
  createClient: (uri: string, options: MongoClientOptions) => MongoClient = (uri, options) =>
    new MongoClient(uri, options),
): MongoConnection {
  const settings = mongoEnvironmentFrom(config);
  let client: MongoClient;
  try {
    client = createClient(settings.MONGODB_URI, mongoClientOptions(settings));
  } catch {
    // The driver parses the URI here and its message can quote part of it: name the key only.
    throw new EnvironmentValidationError('Environment validation failed: MONGODB_URI is not a valid connection string');
  }

  return new MongoConnection(client, settings.MONGODB_DATABASE);
}

/**
 * MongoDB for the AI history (ADR-0020, Proposed), validated when the module is mounted (production requires a URI with
 * credentials). Mounted by `ai-assist` in the API (reads), the worker (delivery) and `ops:ai-purge` (tombstones), each of which
 * validates it when it starts; a process that does not mount it neither needs MongoDB nor checks these keys.
 */
@Module({
  providers: [{ provide: MongoConnection, inject: [ConfigService], useFactory: createMongoConnection }],
  exports: [MongoConnection],
})
export class MongoInfrastructureModule {}
