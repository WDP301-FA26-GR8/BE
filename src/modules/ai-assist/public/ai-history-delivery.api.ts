import { Injectable } from '@nestjs/common';
import { HistoryDeliveryService } from '../history-delivery/history-delivery.service';
import type { AiHistoryDeliveryResult } from './ai-history-delivery.types';

/**
 * The delivery of the raw history of the AI calls to MongoDB (ADR-0020), for the loop of the worker: one round per call. Only the
 * worker mounts it (`AiAssistHistoryFacadeModule`); the API writes the intents, never MongoDB.
 */
@Injectable()
export class AiHistoryDeliveryApi {
  constructor(private readonly delivery: HistoryDeliveryService) {}

  async deliverDue(): Promise<AiHistoryDeliveryResult> {
    return { ...(await this.delivery.deliverDue()), batchSize: HistoryDeliveryService.BATCH_SIZE };
  }
}
