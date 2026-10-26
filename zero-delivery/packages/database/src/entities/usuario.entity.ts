import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RolUsuarioDb } from "@zero-delivery/shared-types";

@Entity({ name: "usuarios" })
@Unique(["inquilino_id", "nombre_usuario"])
export class UsuarioEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "nombre_usuario", type: "text" })
  nombre_usuario!: string;

  @Column({ name: "hash_contrasena", type: "text", select: false }) // Por seguridad, no seleccionar el hash por defecto
  hash_contrasena!: string;

  @Column({ name: "nombre_mostrado", type: "text" })
  nombre_mostrado!: string;

  @Column({ type: "text" })
  rol!: RolUsuarioDb;

  @Column({ name: "esta_activo", type: "boolean", default: true })
  esta_activo!: boolean;

  @Column({ name: "intentos_fallidos", type: "integer", default: 0 })
  intentos_fallidos!: number;

  @Column({ name: "bloqueado_hasta", type: "timestamptz", nullable: true })
  bloqueado_hasta!: Date | null;

  @Column({ name: "ultimo_acceso_en", type: "timestamptz", nullable: true })
  ultimo_acceso_en!: Date | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
