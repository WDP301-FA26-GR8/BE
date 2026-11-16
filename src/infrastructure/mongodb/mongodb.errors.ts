/**
 * MongoDB could not answer (no server selected, a timeout, a refused connection). The message is fixed: a driver message can
 * name the host or the user of the connection string, so it travels only as `cause`, which callers must not log or return.
 */
export class MongoUnavailableError extends Error {
  readonly code = 'MONGODB_UNAVAILABLE';

  constructor(options?: { cause?: unknown }) {
    super('MongoDB is temporarily unavailable.', options);
    this.name = 'MongoUnavailableError';
  }
}
