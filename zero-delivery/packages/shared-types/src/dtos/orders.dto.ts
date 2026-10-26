import { z } from "zod";
import { OrderStatus, PaymentMethod, PaymentStatus } from "../domain/enums";

/**
 * Esquemas Zod y DTOs para Creación y Transiciones de Pedidos
 */

export const itemPedidoInputSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.number().int().positive("La cantidad debe ser mayor a 0"),
  modificadores: z
    .array(
      z.object({
        opcion_id: z.string().uuid(),
        nombre_snapshot: z.string(),
        incremento_precio_centavos: z.number().int(),
      })
    )
    .default([]),
});

export type ItemPedidoInput = z.infer<typeof itemPedidoInputSchema>;

export const crearPedidoManualSchema = z.object({
  sucursal_id: z.string().uuid(),
  cliente_id: z.string().uuid().optional(),
  cliente_nuevo: z
    .object({
      nombre: z.string().min(2),
      telefono_e164: z.string().regex(/^\+[1-9]\d{7,14}$/),
    })
    .optional(),
  direccion_snapshot: z.object({
    texto_direccion: z.string().min(3),
    referencia: z.string().nullable().optional(),
    latitud: z.number().nullable().optional(),
    longitud: z.number().nullable().optional(),
  }),
  zona_entrega_id: z.string().uuid().nullable().optional(),
  canal: z.enum(["MANUAL", "WEB", "WHATSAPP", "CRM"]).default("MANUAL"),
  metodo_pago: z.enum(["EFECTIVO", "YAPE", "TRANSFERENCIA_BANCARIA"]),
  efectivo_por_cobrar_centavos: z.number().int().nonnegative().default(0),
  factura_solicitada: z.boolean().default(false),
  notas: z.string().nullable().optional(),
  clave_idempotencia: z.string().nullable().optional(),
  items: z.array(itemPedidoInputSchema).min(1, "El pedido debe contener al menos un ítem"),
});

export type CrearPedidoManualInput = z.infer<typeof crearPedidoManualSchema>;

export const transitionOrderSchema = z.object({
  nuevo_estado: z.nativeEnum(OrderStatus),
  motivo: z.string().min(3, "El motivo debe tener al menos 3 caracteres").optional(),
  efectivo_cobrado_centavos: z.number().int().nonnegative().optional(),
});

export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>;

/**
 * DTO Público para el Cliente (Seguridad y Privacidad Estricta)
 * NUNCA expone: precio base, empaque, margen de agencia, pago al restaurante ni GPS.
 */
export interface CustomerOrderDTO {
  numero: number;
  estado_operativo: OrderStatus;
  estado_pago: PaymentStatus;
  metodo_pago: PaymentMethod;
  fecha_creacion: string;
  subtotal_items_centavos: number;
  descuento_centavos: number;
  tarifa_entrega_centavos: number;
  total_centavos: number;
  items: Array<{
    nombre: string;
    cantidad: number;
    precio_unitario_centavos: number;
    total_linea_centavos: number;
    modificadores: Array<{ nombre: string }>;
  }>;
}

/**
 * DTO para Encargado de Sucursal (Cocina y Despacho)
 * Incluye precio base y empaque para control de stock, estado de pago al restaurante y handoff.
 * NUNCA expone: margen de la agencia.
 */
export interface BranchManagerOrderDTO {
  id: string;
  numero: number;
  sucursal_id: string;
  estado_operativo: OrderStatus;
  estado_pago: PaymentStatus;
  estado_pago_restaurante: "PENDIENTE" | "CONFIRMADO";
  traspaso_en: string | null;
  traspaso_por: string | null;
  creado_en: string;
  total_centavos: number;
  items: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    precio_base_centavos: number;
    empaque_centavos: number;
    precio_unitario_centavos: number;
    total_linea_centavos: number;
    estado: string;
    modificadores: Array<{ nombre: string; incremento_precio_centavos: number }>;
  }>;
}

/**
 * DTO Completo para Personal de la Agencia (Admin, Coordinador, Empleado)
 */
export interface StaffOrderDTO {
  id: string;
  numero: number;
  inquilino_id: string;
  sucursal_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion_snapshot: Record<string, unknown>;
  canal: string;
  estado_operativo: OrderStatus;
  estado_pago: PaymentStatus;
  metodo_pago: PaymentMethod;
  estado_pago_restaurante: "PENDIENTE" | "CONFIRMADO";
  traspaso_en: string | null;
  traspaso_por: string | null;
  liberado_en: string | null;
  liberado_por: string | null;
  repartidor_id: string | null;
  repartidor_nombre?: string | null;
  zona_entrega_id: string | null;
  subtotal_items_centavos: number;
  descuento_centavos: number;
  tarifa_entrega_centavos: number;
  impuesto_centavos: number;
  total_centavos: number;
  efectivo_por_cobrar_centavos: number;
  factura_solicitada: boolean;
  token_publico: string;
  notas: string | null;
  version: number;
  creado_en: string;
  actualizado_en: string;
  items: Array<{
    id: string;
    producto_id: string;
    nombre: string;
    cantidad: number;
    precio_base_centavos: number;
    empaque_centavos: number;
    margen_centavos: number;
    precio_unitario_centavos: number;
    total_linea_centavos: number;
    estado: string;
    modificadores: Array<{ nombre: string; incremento_precio_centavos: number }>;
  }>;
}
