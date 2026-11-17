import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { MongoInfrastructureModule } from '../../infrastructure/mongodb/mongodb-infrastructure.module';
import { HistoryDeliveryService } from './history-delivery/history-delivery.service';
import { InvocationHistoryOutboxRepo } from './invocation-history/invocation-history-outbox.repo';
import { InvocationHistoryStoreRepo } from './invocation-history/invocation-history-store.repo';
import { AiHistoryDeliveryApi } from './public/ai-history-delivery.api';

/**
 * The part of ai-assist the worker mounts: the delivery of the outbox of the raw history to MongoDB (ADR-0020), and nothing else.
 * No AI service, no controller, no Request, no switch. Mounting it validates the MongoDB settings.
 */
@Module({
  imports: [DatabaseModule, MongoInfrastructureModule],
  providers: [InvocationHistoryOutboxRepo, InvocationHistoryStoreRepo, HistoryDeliveryService, AiHistoryDeliveryApi],
  exports: [AiHistoryDeliveryApi],
})
export class AiAssistHistoryFacadeModule {}
