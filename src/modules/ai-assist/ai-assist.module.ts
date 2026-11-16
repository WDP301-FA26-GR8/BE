import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { MongoInfrastructureModule } from '../../infrastructure/mongodb/mongodb-infrastructure.module';
import { AuditModule } from '../audit/audit.module';
import { OperatingParametersModule } from '../operating-parameters/operating-parameters.module';
import { OrganizationModule } from '../organization/organization.module';
import { RequestsModule } from '../requests/requests.module';
import { HttpAiServiceClient } from './ai-service/ai-service-client.service';
import { aiServiceSettingsFrom } from './ai-service/ai-service-environment.policy';
import { AiServiceClient } from './ai-service/ai-service.types';
import { InvocationContentQueryService } from './invocation-content/invocation-content-query.service';
import { InvocationHistoryOutboxRepo } from './invocation-history/invocation-history-outbox.repo';
import { InvocationHistoryRecordService } from './invocation-history/invocation-history-record.service';
import { InvocationHistoryStoreRepo } from './invocation-history/invocation-history-store.repo';
import { AiInvocationRepo } from './invocation/invocation.repo';
import { QueueSummaryRunService } from './queue-summary/queue-summary-run.service';
import { QueueSummaryService } from './queue-summary/queue-summary.service';

/**
 * The AI summary of the approval queue of a person (`US-15-05`): the client of the AI service, the record of each call and the
 * result of its checks (`ai_invocations`, `ai_invocation_results`), the outbox of its raw history (`ai_history_deliveries`), the
 * read of that history in MongoDB for the Super Admin (ADR-0020), and the use case. MongoDB is read here, never written: the worker
 * delivers the outbox (`AiAssistHistoryFacadeModule`). Mounting this module validates the MongoDB settings (production requires a
 * URI with credentials); MongoDB being down does not stop the start. It reads the steps through the facade of `requests`, the
 * two switches through the operating parameters, and writes the audit trail. The settings of the AI service are checked when the
 * module is mounted: none means the feature answers that it is unavailable, an address without its token stops the start.
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
    InvocationHistoryRecordService,
    InvocationContentQueryService,
    QueueSummaryRunService,
    QueueSummaryService,
    {
      provide: AiServiceClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new HttpAiServiceClient(aiServiceSettingsFrom((key) => config.get(key))),
    },
  ],
  exports: [QueueSummaryService, InvocationContentQueryService],
})
export class AiAssistModule {}
