import { Logger } from '@nestjs/common';
import { AiHistoryDeliveryLoop } from './ai-history-delivery.job';

const round = (claimed: number) => ({ claimed, batchSize: 20, delivered: claimed, obsolete: 0, retried: 0, parked: 0 });

describe('AiHistoryDeliveryLoop', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function build(deliverDue: jest.Mock) {
    const config = { get: jest.fn().mockReturnValue(1000) };
    const loop = new AiHistoryDeliveryLoop({ deliverDue } as never, config as never);

    return { loop, config };
  }

  it('waits OUTBOX_POLL_INTERVAL_MS after a round that did not fill a batch', async () => {
    const deliverDue = jest.fn().mockResolvedValue(round(3));
    const { loop, config } = build(deliverDue);

    loop.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(999);
    expect(deliverDue).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(deliverDue).toHaveBeenCalledTimes(2);
    expect(config.get).toHaveBeenCalledWith('OUTBOX_POLL_INTERVAL_MS', { infer: true });
    await loop.onModuleDestroy();
  });

  it('runs the next round at once after a full batch: a backlog drains without waiting', async () => {
    const deliverDue = jest
      .fn()
      .mockResolvedValueOnce(round(20))
      .mockResolvedValueOnce(round(20))
      .mockResolvedValue(round(0));
    const { loop } = build(deliverDue);

    loop.onApplicationBootstrap();
    // Well under the poll interval (1000 ms): only rounds scheduled at once can run in it.
    for (let step = 0; step < 10; step += 1) await jest.advanceTimersByTimeAsync(1);
    expect(deliverDue).toHaveBeenCalledTimes(3);
    await loop.onModuleDestroy();
  });

  it('logs a failed tick by the error name only, never its message, and ticks again', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const deliverDue = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('mongodb+srv://user:s3cr3t@cluster/x'))
      .mockResolvedValue(round(0));
    const { loop } = build(deliverDue);

    loop.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(logged).toHaveBeenCalledWith(
      'AI history delivery tick failed: TypeError retryable=false',
      expect.stringMatching(/^\s+at /),
    );
    expect(JSON.stringify(logged.mock.calls)).not.toContain('s3cr3t');
    await jest.advanceTimersByTimeAsync(1000);
    expect(deliverDue).toHaveBeenCalledTimes(2);
    logged.mockRestore();
    await loop.onModuleDestroy();
  });

  it('stops scheduling once the module is destroyed', async () => {
    const deliverDue = jest.fn().mockResolvedValue(round(0));
    const { loop } = build(deliverDue);

    loop.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    await loop.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(deliverDue).toHaveBeenCalledTimes(1);
  });
});
