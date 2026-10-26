import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { UsuarioEntity } from "./usuario.entity";

/**
 * Suscripción Web Push de un usuario. Tabla `suscripciones_push`.
 * `punto_final` es el endpoint único del navegador; `claves` guarda p256dh/auth.
 */
@Entity({ name: "suscripciones_push" })
export class SuscripcionPushEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "usuario_id", type: "uuid" })
  usuario_id!: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "usuario_id" })
  usuario?: UsuarioEntity;

  @Column({ name: "punto_final", type: "text", unique: true })
  punto_final!: string;

  @Column({ type: "jsonb" })
  claves!: Record<string, unknown>;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
