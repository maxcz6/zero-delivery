import { z } from "zod";

/**
 * Esquemas Zod y DTOs para Clientes y Direcciones
 */

export const direccionClienteSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid().optional(),
  etiqueta: z.string().nullable().optional(), // Ej: Casa, Trabajo
  texto_direccion: z.string().min(3, "La dirección debe ser descriptiva"),
  referencia: z.string().nullable().optional(),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
  zona_id: z.string().uuid().nullable().optional(),
});

export type DireccionClienteInput = z.infer<typeof direccionClienteSchema>;

export const clienteSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().min(2, "El nombre del cliente debe tener al menos 2 caracteres"),
  telefono_e164: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "El teléfono debe cumplir con el formato E.164 (ej: +51987654321)"),
  correo: z.string().email("Correo electrónico inválido").nullable().optional(),
  segmento: z.enum(["NUEVO", "RECURRENTE", "TOP"]).default("NUEVO"),
  marca_riesgo: z.enum(["NINGUNO", "PRECAUCION", "BLOQUEADO"]).default("NINGUNO"),
  motivo_riesgo: z.string().nullable().optional(),
  riesgo_definido_por: z.string().uuid().nullable().optional(),
  notas: z.string().nullable().optional(),
  direcciones: z.array(direccionClienteSchema).optional(),
}).refine(
  (data) => {
    if (data.marca_riesgo !== "NINGUNO") {
      return Boolean(data.motivo_riesgo && data.riesgo_definido_por);
    }
    return true;
  },
  {
    message: "Una marca de riesgo exige motivo y usuario responsable",
    path: ["marca_riesgo"],
  }
);

export type ClienteInput = z.infer<typeof clienteSchema>;

export const actualizarRiesgoClienteSchema = z.object({
  marca_riesgo: z.enum(["NINGUNO", "PRECAUCION", "BLOQUEADO"]),
  motivo_riesgo: z.string().min(5, "El motivo de riesgo debe ser detallado"),
});

export type ActualizarRiesgoClienteInput = z.infer<typeof actualizarRiesgoClienteSchema>;
