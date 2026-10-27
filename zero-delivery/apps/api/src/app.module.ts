import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getDataSourceOptions } from "@zero-delivery/database";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { IdentityModule } from "./modules/identity/identity.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { LogisticsModule } from "./modules/logistics/logistics.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { AuditModule } from "./modules/audit/audit.module";
import { VoceroIntegrationModule } from "./modules/integrations/vocero/vocero-integration.module";
import { ReportingModule } from "./modules/reporting/reporting.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    TypeOrmModule.forRoot({
      ...getDataSourceOptions(),
      autoLoadEntities: true,
    }),
    IdentityModule,
    CatalogModule,
    OrdersModule,
    PaymentsModule,
    LogisticsModule,
    SettingsModule,
    AuditModule,
    VoceroIntegrationModule,
    ReportingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
