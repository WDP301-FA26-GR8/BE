import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../infrastructure/config/env-schema';
import { describeForOperator, traceForOperator } from '../infrastructure/observability/operator-error';
import { AiHistoryDeliveryApi } from '../modules/ai-assist/public/ai-history-delivery.api';

/**
 * The worker's loop of the raw AI history (ADR-0020): a database poll of the outbox `ai_history_deliveries`, delivered to MongoDB.
 * A round that took a full batch is followed by another at once; otherwise the loop waits OUTBOX_POLL_INTERVAL_MS. A tick never
 * overlaps the previous one, and a failed tick only logs: the rows stay queued.
 */
@Injectable()
export class AiHistoryDeliveryLoop implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AiHistoryDeliveryLoop.name);
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;
  private running: Promise<void> | undefined;

  constructor(
    private readonly delivery: AiHistoryDeliveryApi,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onApplicationBootstrap(): void {
    this.stopped = false;
    this.schedule(0);
  }

  /** Stops before the database disconnects and waits for the round in progress, so its acknowledgements are written. */
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    let more = false;
    try {
      const round = await this.delivery.deliverDue();
      more = round.claimed >= round.batchSize;
    } catch (error) {
      this.logger.error(`AI history delivery tick failed: ${describeForOperator(error)}`, traceForOperator(error));
    } finally {
      this.schedule(more ? 0 : this.config.get('OUTBOX_POLL_INTERVAL_MS', { infer: true }));
    }
  }
}
