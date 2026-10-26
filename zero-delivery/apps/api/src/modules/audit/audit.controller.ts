import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ActorContext } from "@zero-delivery/shared-types";
import { AuditService } from "./audit.service";

function parseFecha(valor: string | undefined, campo: string): Date | undefined {
  if (!valor) return undefined;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new BadRequestException(
      `El parámetro ${campo} no es una fecha válida (use ISO-8601)`
    );
  }
  return fecha;
}

@Controller("audit")
@UseGuards(AuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission("audit.view")
  async list(
    @CurrentActor() actor: ActorContext,
    @Query("accion") accion?: string,
    @Query("tipo_objeto") tipoObjeto?: string,
    @Query("objeto_id") objetoId?: string,
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string,
    @Query("limite") limite?: string,
    @Query("desplazamiento") desplazamiento?: string
  ) {
    const resultado = await this.auditService.list(actor, {
      accion,
      tipoObjeto,
      objetoId,
      desde: parseFecha(desde, "desde"),
      hasta: parseFecha(hasta, "hasta"),
      limite: limite ? Number(limite) : undefined,
      desplazamiento: desplazamiento ? Number(desplazamiento) : undefined,
    });

    return { ok: true, ...resultado };
  }
}
