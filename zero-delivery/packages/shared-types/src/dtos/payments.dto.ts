import { z } from "zod";

/**
 * Esquemas Zod y DTOs para Pagos, Conciliación y Reembolsos
 */

export const validarPagoSchema = z.object({
  pago_id: z.string().uuid(),
  referencia: z.string().min(2, "La referencia o número de operación es obligatoria"),
  archivo_comprobante_id: z.string().uuid().optional(),
});

export type ValidarPagoInput = z.infer<typeof validarPagoSchema>;

export const confirmarPagoRestauranteSchema = z.object({
  pedido_id: z.string().uuid(),
  monto_centavos: z.number().int().nonnegative(),
  metodo: z.string().min(2),
  referencia: z.string().optional(),
});

export type ConfirmarPagoRestauranteInput = z.infer<typeof confirmarPagoRestauranteSchema>;

export const corregirPagoSchema = z.object({
  pago_id: z.string().uuid(),
  nuevo_monto_centavos: z.number().int().positive("El monto corregido debe ser mayor a 0"),
  nuevo_estado: z.enum(["PENDIENTE", "PAGADO", "RECHAZADO", "REEMBOLSADO"]),
  motivo: z.string().min(4, "El motivo de la corrección debe tener al menos 4 caracteres"),
});

export type CorregirPagoInput = z.infer<typeof corregirPagoSchema>;

export const reembolsoSchema = z.object({
  pedido_id: z.string().uuid(),
  pago_id: z.string().uuid().optional(),
  monto_centavos: z.number().int().positive("El monto a reembolsar debe ser mayor a 0"),
  motivo: z.string().min(5, "El motivo del reembolso debe estar justificado"),
  metodo: z.string().optional(),
  referencia: z.string().optional(),
});

export type ReembolsoInput = z.infer<typeof reembolsoSchema>;
