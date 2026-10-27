import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ActorContext, RolUsuarioDb } from "@zero-delivery/shared-types";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(AuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(@CurrentActor() actor: ActorContext) {
    if (actor.role !== "ADMIN" && actor.role !== "BRANCH_MANAGER") {
      throw new ForbiddenException("Solo el Administrador o Encargado pueden listar usuarios");
    }
    const usuarios = await this.usersService.listUsers(actor);
    return { ok: true, data: usuarios };
  }

  @Post()
  async createUser(
    @CurrentActor() actor: ActorContext,
    @Body()
    body: {
      nombre_usuario: string;
      nombre_mostrado: string;
      password: string;
      rol: RolUsuarioDb;
      sucursal_ids?: string[];
    }
  ) {
    const created = await this.usersService.createUser(actor, body);
    return { ok: true, data: created };
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

  @Put(":userId/branches")
  async setUserBranches(
    @CurrentActor() actor: ActorContext,
    @Param("userId") userId: string,
    @Body() body: { sucursal_ids?: string[] }
  ) {
    if (actor.role !== "ADMIN" && actor.role !== "BRANCH_MANAGER") {
      throw new ForbiddenException("No autorizado para asignar sucursales");
    }
    const data = await this.usersService.setUserBranches(
      actor,
      userId,
      Array.isArray(body.sucursal_ids) ? body.sucursal_ids : []
    );
    return { ok: true, data };
  }
}
