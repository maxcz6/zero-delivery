import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RegistroAuditoriaEntity } from "@zero-delivery/database";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { IdentityModule } from "../identity/identity.module";

@Module({
  imports: [TypeOrmModule.forFeature([RegistroAuditoriaEntity]), IdentityModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
