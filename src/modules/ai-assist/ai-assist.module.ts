import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { MongoInfrastructureModule } from '../../infrastructure/mongodb/mongodb-infrastructure.module';
import { AuditModule } from '../audit/audit.module';
import { OperatingParametersModule } from '../operating-parameters/operating-parameters.module';
import { OrganizationModule } from '../organization/organization.module';
import { RequestsModule } from '../requests/requests.module';
import { HttpAiServiceClient } from './ai-service/ai-service-client.service';
import { AiServiceClients } from './ai-service/ai-service-clients.service';
import { aiServiceSettingsFrom } from './ai-service/ai-service-environment.policy';
import { SimulatedAiServiceClient } from './ai-service/ai-service-simulated-client.service';
import { AiServiceClient } from './ai-service/ai-service.types';
import { InvocationContentQueryService } from './invocation-content/invocation-content-query.service';
import { InvocationHistoryOutboxRepo } from './invocation-history/invocation-history-outbox.repo';
import { InvocationHistoryStoreRepo } from './invocation-history/invocation-history-store.repo';
import { MongoInvocationHistoryRepo } from './invocation-history/invocation-history-mongo.repo';
import { AiInvocationHistoryStore } from './invocation/invocation-history-store.types';
import { AiInvocationRepo } from './invocation/invocation.repo';
import { QueueSummaryRunService } from './queue-summary/queue-summary-run.service';
import { QueueSummaryService } from './queue-summary/queue-summary.service';

/**
 * The AI summary of the approval queue of a person (`US-15-05`): the client of each mode (`AiServiceClients`: the AI service, or the
 * simulation that calls no model), the record of each call and the result of its checks (`ai_invocations`, `ai_invocation_results`),
 * the outbox of its raw history (`ai_history_deliveries`), the read of that history in MongoDB for the Super Admin (ADR-0020), and the
 * use case. The history store of the port `AiInvocationHistoryStore` is the MongoDB one here (`MongoInvocationHistoryRepo`): MongoDB is
 * read, never written; the worker delivers the outbox (`AiAssistHistoryFacadeModule`). Mounting this module validates the MongoDB
 * settings (production requires a URI with credentials); MongoDB being down does not stop the start. It reads the steps through the
 * facade of `requests`, the two switches and the mode (`AI_PROVIDER_MODE`) through the operating parameters, and writes the audit
 * trail. The settings of the AI service are checked when the module is mounted: none means the feature answers that it is unavailable
 * in the mode MODEL, an address without its token stops the start.
 */
@Module({
  imports: [
    DatabaseModule,
    MongoInfrastructureModule,
    AuditModule,
    OperatingParametersModule,
    OrganizationModule,
    RequestsModule,
  ],
  providers: [
    AiInvocationRepo,
    InvocationHistoryOutboxRepo,
    InvocationHistoryStoreRepo,
    MongoInvocationHistoryRepo,
    { provide: AiInvocationHistoryStore, useExisting: MongoInvocationHistoryRepo },
    InvocationContentQueryService,
    QueueSummaryRunService,
    QueueSummaryService,
    {
      provide: AiServiceClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new HttpAiServiceClient(aiServiceSettingsFrom((key) => config.get(key))),
    },
    { provide: SimulatedAiServiceClient, useFactory: () => new SimulatedAiServiceClient() },
    AiServiceClients,
  ],
  exports: [QueueSummaryService, InvocationContentQueryService],
})
export class AiAssistModule {}
