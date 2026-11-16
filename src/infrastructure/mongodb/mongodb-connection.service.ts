import type { OnApplicationShutdown } from '@nestjs/common';
import type { Db, MongoClient } from 'mongodb';
import { MongoUnavailableError } from './mongodb.errors';

/** The part of `MongoClient` this service uses, so a spec can stand in for the driver. */
export type MongoClientLike = Pick<MongoClient, 'db' | 'close'>;

/**
 * The one MongoDB client of the process (ADR-0020): the database of the AI history, a ping, and the close on shutdown. It
 * never connects eagerly — the driver connects on the first operation — so MongoDB being down does not stop the process from
 * starting; a caller that needs it gets `MongoUnavailableError` within the configured timeouts.
 */
export class MongoConnection implements OnApplicationShutdown {
  private closing: Promise<void> | null = null;

  constructor(
    private readonly client: MongoClientLike,
    private readonly databaseName: string,
  ) {}

  /** The database of the AI history; collections and their schema belong to the module that mounts this one. */
  database(): Db {
    return this.client.db(this.databaseName);
  }

  /** Resolves when the server answers `ping`; anything else is `MongoUnavailableError`, without the driver's message. */
  async ping(): Promise<void> {
    try {
      await this.database().command({ ping: 1 });
    } catch (error) {
      throw new MongoUnavailableError({ cause: error });
    }
  }

  /** Closes the pool once, however many times the process asks. */
  onApplicationShutdown(): Promise<void> {
    this.closing ??= this.client.close();

    return this.closing;
  }
}
