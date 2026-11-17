import type { Db } from 'mongodb';
import { MongoConnection, type MongoClientLike } from './mongodb-connection.service';
import { MongoUnavailableError } from './mongodb.errors';

function fakeClient(command: jest.Mock): { client: MongoClientLike; db: jest.Mock; close: jest.Mock } {
  const db = jest.fn(() => ({ command }) as unknown as Db);
  const close = jest.fn(() => Promise.resolve());

  return { client: { db, close }, db, close };
}

describe('MongoConnection', () => {
  it('pings the configured database (MI-08)', async () => {
    const command = jest.fn(() => Promise.resolve({ ok: 1 }));
    const { client, db } = fakeClient(command);

    await expect(new MongoConnection(client, 'slm_ai_history').ping()).resolves.toBeUndefined();
    expect(db).toHaveBeenCalledWith('slm_ai_history');
    expect(command).toHaveBeenCalledWith({ ping: 1 });
  });

  it('turns a failed ping into MongoUnavailableError without the driver message (MI-08)', async () => {
    const driverError = new Error(
      'Server selection timed out after 2000 ms: mongodb://history:secret@mongodb.internal',
    );
    const { client } = fakeClient(jest.fn(() => Promise.reject(driverError)));

    const error = await new MongoConnection(client, 'slm_ai_history').ping().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MongoUnavailableError);
    expect((error as MongoUnavailableError).code).toBe('MONGODB_UNAVAILABLE');
    expect((error as Error).message).toBe('MongoDB is temporarily unavailable.');
    expect((error as Error).cause).toBe(driverError);
  });

  it('closes the client once however many times shutdown runs (MI-09)', async () => {
    const { client, close } = fakeClient(jest.fn());
    const connection = new MongoConnection(client, 'slm_ai_history');

    await Promise.all([connection.onApplicationShutdown(), connection.onApplicationShutdown()]);
    await connection.onApplicationShutdown();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
