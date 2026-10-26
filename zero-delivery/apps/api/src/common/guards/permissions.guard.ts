import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSION_KEY } from "../decorators/require-permission.decorator";
import {
  can,
  PermissionKey,
  ActorContext,
  ResourceRef,
} from "@zero-delivery/shared-types";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<PermissionKey>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const actor: ActorContext | undefined = request.actor;

    if (!actor) {
      throw new ForbiddenException("Contexto de actor ausente");
    }

    // Determinar referencia al recurso a partir de los parámetros de la solicitud
    const branchId =
      request.params?.sucursalId ||
      request.params?.branchId ||
      request.body?.sucursal_id ||
      request.body?.branchId;

    const riderId =
      request.params?.repartidorId ||
      request.params?.riderId ||
      request.body?.repartidor_id ||
      request.body?.riderId;

    const resource: ResourceRef = {
      tenantId: actor.tenantId,
      branchId: branchId ? String(branchId) : undefined,
      riderId: riderId ? String(riderId) : undefined,
    };

    const decision = can(actor, requiredPermission, resource);

    if (!decision.allowed) {
      const reason = "reason" in decision ? decision.reason : "No tiene permisos para realizar esta acción";
      throw new ForbiddenException(reason);
    }

    return true;
  }
}
