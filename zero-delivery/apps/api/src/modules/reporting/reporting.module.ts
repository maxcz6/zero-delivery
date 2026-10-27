import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";

@Module({
  imports: [IdentityModule],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
