import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ActorContext } from "@zero-delivery/shared-types";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(AuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission("user.manage")
  async listUsers(@CurrentActor() actor: ActorContext) {
    const usuarios = await this.usersService.listUsers(actor);
    return { ok: true, data: usuarios };
  }

  @Patch(":userId/status")
  @RequirePermission("user.manage")
  async setStatus(
    @CurrentActor() actor: ActorContext,
    @Param("userId") userId: string,
    @Body() body: { esta_activo?: boolean }
  ) {
    if (typeof body.esta_activo !== "boolean") {
      throw new BadRequestException("El campo esta_activo es obligatorio");
    }
    const usuario = await this.usersService.setStatus(
      actor,
      userId,
      body.esta_activo
    );
    return { ok: true, data: usuario };
  }
}
