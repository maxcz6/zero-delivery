import { z } from "zod";

/**
 * Esquemas Zod y DTOs para Catálogo (Categorías, Productos, Modificadores, Cartas)
 */

export const categoriaSchema = z.object({
  id: z.string().uuid().optional(),
  restaurante_id: z.string().uuid(),
  nombre: z.string().min(1, "El nombre de la categoría es obligatorio"),
  orden: z.number().int().default(0),
});

export type CategoriaInput = z.infer<typeof categoriaSchema>;

export const productoSchema = z.object({
  id: z.string().uuid().optional(),
  restaurante_id: z.string().uuid(),
  categoria_id: z.string().uuid().nullable().optional(),
  nombre: z.string().min(1, "El nombre del producto es obligatorio"),
  descripcion: z.string().nullable().optional(),
  archivo_imagen_id: z.string().uuid().nullable().optional(),
  es_fragil: z.boolean().default(false),
  precio_base_centavos: z.number().int().nonnegative("El precio base no puede ser negativo"),
  empaque_centavos: z.number().int().nonnegative("El costo de empaque no puede ser negativo").default(0),
  tipo_margen: z.enum(["FIJO", "PORCENTAJE"]).default("FIJO"),
  valor_margen: z.number().nonnegative().default(0),
  esta_activo: z.boolean().default(true),
});

export type ProductoInput = z.infer<typeof productoSchema>;

export const opcionModificadorSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().min(1, "El nombre de la opción es obligatorio"),
  incremento_precio_centavos: z.number().int().default(0),
  esta_activo: z.boolean().default(true),
  orden: z.number().int().default(0),
});

export type OpcionModificadorInput = z.infer<typeof opcionModificadorSchema>;

export const grupoModificadoresSchema = z.object({
  id: z.string().uuid().optional(),
  restaurante_id: z.string().uuid(),
  nombre: z.string().min(1, "El nombre del grupo es obligatorio"),
  minimo_seleccion: z.number().int().nonnegative().default(0),
  maximo_seleccion: z.number().int().positive().default(1),
  opciones: z.array(opcionModificadorSchema).optional(),
}).refine((data) => data.maximo_seleccion >= data.minimo_seleccion, {
  message: "El máximo de selección debe ser mayor o igual al mínimo",
  path: ["maximo_seleccion"],
});

export type GrupoModificadoresInput = z.infer<typeof grupoModificadoresSchema>;

export const cartaSchema = z.object({
  id: z.string().uuid().optional(),
  sucursal_id: z.string().uuid(),
  nombre: z.string().min(1, "El nombre de la carta es obligatorio"),
  es_predeterminada: z.boolean().default(false),
  incluye_entrega_en_precio: z.boolean().default(false),
  incluye_impuesto_en_precio: z.boolean().default(false),
  horario: z.record(z.unknown()).nullable().optional(),
  esta_activa: z.boolean().default(true),
});

export type CartaInput = z.infer<typeof cartaSchema>;

export const itemCartaSchema = z.object({
  id: z.string().uuid().optional(),
  carta_id: z.string().uuid(),
  producto_id: z.string().uuid(),
  precio_centavos: z.number().int().nonnegative("El precio publicado no puede ser negativo"),
  esta_disponible: z.boolean().default(true),
  orden: z.number().int().default(0),
});

export type ItemCartaInput = z.infer<typeof itemCartaSchema>;
