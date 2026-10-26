import { z } from "zod";

export const loginSchema = z.object({
  inquilino_slug: z.string().min(1, "El slug de inquilino es obligatorio"),
  nombre_usuario: z.string().min(1, "El nombre de usuario es obligatorio"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type LoginDto = z.infer<typeof loginSchema>;
