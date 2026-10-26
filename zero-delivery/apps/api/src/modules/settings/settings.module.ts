import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfiguracionEntity } from "@zero-delivery/database";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";
import { IdentityModule } from "../identity/identity.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfiguracionEntity]),
    IdentityModule,
    AuditModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
