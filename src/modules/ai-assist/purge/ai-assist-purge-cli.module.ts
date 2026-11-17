import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { MongoInfrastructureModule } from '../../../infrastructure/mongodb/mongodb-infrastructure.module';
import { AuditModule } from '../../audit/audit.module';
import { OrganizationModule } from '../../organization/organization.module';
import { HistoryDeliveryService } from '../history-delivery/history-delivery.service';
import { InvocationHistoryOutboxRepo } from '../invocation-history/invocation-history-outbox.repo';
import { MongoInvocationHistoryRepo } from '../invocation-history/invocation-history-mongo.repo';
import { InvocationHistoryStoreRepo } from '../invocation-history/invocation-history-store.repo';
import { AiInvocationHistoryStore } from '../invocation/invocation-history-store.types';
import { AiInvocationRepo } from '../invocation/invocation.repo';
import { AiPurgeApi } from '../public/ai-purge.api';

/**
 * The graph of `pnpm ops:ai-purge`: the calls, the outbox of the raw history and MongoDB (to write the tombstones), the purge, and
 * the facades it writes through. No AI service, no switch, no controller. Never imported by the API, the worker or another command.
 */
@Module({
  imports: [DatabaseModule, MongoInfrastructureModule, OrganizationModule, AuditModule],
  providers: [
    AiInvocationRepo,
    InvocationHistoryOutboxRepo,
    InvocationHistoryStoreRepo,
    MongoInvocationHistoryRepo,
    { provide: AiInvocationHistoryStore, useExisting: MongoInvocationHistoryRepo },
    HistoryDeliveryService,
    AiPurgeApi,
  ],
  exports: [AiPurgeApi],
})
export class AiAssistPurgeCliModule {}
