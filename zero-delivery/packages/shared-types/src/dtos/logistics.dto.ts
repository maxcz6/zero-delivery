import { z } from "zod";

/**
 * Esquemas Zod y DTOs para Logística, Repartidores y Liquidaciones
 */

export const repartidorSchema = z.object({
  id: z.string().uuid().optional(),
  usuario_id: z.string().uuid().optional(),
  nombre_completo: z.string().min(3, "El nombre completo es obligatorio"),
  telefono: z.string().min(7, "El teléfono es obligatorio"),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
  tipo_flota: z.enum(["PROPIO", "AGENCIA", "TERCERO"]),
  nombre_agencia: z.string().nullable().optional(),
  tipo_vehiculo: z.enum(["MOTO", "AUTO"]),
  estado: z.enum(["DISPONIBLE", "OCUPADO", "EN_CAMINO", "DESCONECTADO"]).default("DESCONECTADO"),
  alta_confianza: z.boolean().default(false),
  esta_activo: z.boolean().default(true),
});

export type RepartidorInput = z.infer<typeof repartidorSchema>;

export interface ElegibilidadRiderResult {
  elegible: boolean;
  motivos: string[];
  bloqueadoPorDeuda: boolean;
  saldoGarantiaCentavos: number;
}

export const crearAdelantoSchema = z.object({
  repartidor_id: z.string().uuid(),
  monto_centavos: z.number().int().positive("El monto del adelanto debe ser positivo"),
  proposito: z.string().default("COMBUSTIBLE"),
});

export type CrearAdelantoInput = z.infer<typeof crearAdelantoSchema>;

export const liquidacionInputSchema = z.object({
  repartidor_id: z.string().uuid(),
  fecha_operativa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tarifa_repartidor_pagable_centavos: z.number().int().nonnegative(),
  motivo_ajuste_tarifa_repartidor: z.string().optional(),
});

export type LiquidacionInput = z.infer<typeof liquidacionInputSchema>;

export const ajusteBilleteraSchema = z.object({
  repartidor_id: z.string().uuid(),
  tipo: z.enum(["DEPOSITO_GARANTIA", "RETIRO_GARANTIA", "AJUSTE"]),
  monto_centavos: z.number().int(),
  motivo: z.string().min(5, "El motivo del ajuste debe ser descriptivo"),
});

export type AjusteBilleteraInput = z.infer<typeof ajusteBilleteraSchema>;

export const intentoEntregaSchema = z.object({
  pedido_id: z.string().uuid(),
  numero_intento: z.number().int().min(1).max(2),
  resultado: z.enum(["EN_PROGRESO", "ENTREGADO", "FALLIDO"]),
  motivo_fallo: z.string().optional(),
  notas: z.string().optional(),
  archivo_evidencia_id: z.string().uuid().optional(),
  efectivo_cobrado_centavos: z.number().int().nonnegative().optional(),
}).refine(
  (data) => {
    if (data.resultado === "FALLIDO") {
      return Boolean(data.motivo_fallo);
    }
    return true;
  },
  {
    message: "Un intento fallido exige motivo de fallo",
    path: ["motivo_fallo"],
  }
);

export type IntentoEntregaInput = z.infer<typeof intentoEntregaSchema>;
