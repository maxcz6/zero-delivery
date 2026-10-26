import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ActorContext } from "@zero-delivery/shared-types";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(AuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission("settings.global.manage")
  async list(@CurrentActor() actor: ActorContext) {
    const data = await this.settingsService.list(actor);
    return { ok: true, data };
  }

  @Get(":clave")
  @RequirePermission("settings.global.manage")
  async get(@CurrentActor() actor: ActorContext, @Param("clave") clave: string) {
    const data = await this.settingsService.get(actor, clave);
    return { ok: true, data };
  }

  @Put(":clave")
  @RequirePermission("settings.global.manage")
  async set(
    @CurrentActor() actor: ActorContext,
    @Param("clave") clave: string,
    @Body() body: { valor?: unknown },
    @Req() req: Request
  ) {
    if (!body || !Object.prototype.hasOwnProperty.call(body, "valor")) {
      throw new BadRequestException("El campo valor es obligatorio");
    }

    const idSolicitud =
      (req.headers["x-request-id"] as string | undefined) ?? null;

    const data = await this.settingsService.set(actor, clave, body.valor, {
      ip: req.ip ?? null,
      idSolicitud,
    });

    return { ok: true, data };
  }
}
