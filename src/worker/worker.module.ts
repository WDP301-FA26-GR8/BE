import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../infrastructure/config/configuration.module';
import { DatabaseModule } from '../infrastructure/database/database.module';
import { RuntimeDatabaseRoleModule } from '../infrastructure/database/runtime-role.module';
import { ObservabilityModule } from '../infrastructure/observability/observability.module';
import { AiHistoryDeliveryLoop } from './ai-history-delivery.job';
import { EmailDispatchLoop } from './email-dispatch.job';
import { RequestWorkLoop } from './request-work.job';
import { AiAssistHistoryFacadeModule } from '../modules/ai-assist/ai-assist-history-facade.module';
import { IdentityAccessFacadeModule } from '../modules/identity-access/identity-access-facade.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { RequestsWorkFacadeModule } from '../modules/requests/requests-work-facade.module';

@Module({
  imports: [
    ConfigurationModule,
    ObservabilityModule,
    DatabaseModule,
    RuntimeDatabaseRoleModule,
    NotificationsModule,
    IdentityAccessFacadeModule,
    RequestsWorkFacadeModule,
    AiAssistHistoryFacadeModule,
  ],
  providers: [EmailDispatchLoop, RequestWorkLoop, AiHistoryDeliveryLoop],
})
export class WorkerModule {}
