import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "registro_auditoria" })
export class RegistroAuditoriaEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actor_id!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "actor_id" })
  actor?: UsuarioEntity;

  @Column({ name: "rol_actor", type: "text", nullable: true })
  rol_actor!: string | null;

  @Column({ type: "text" })
  accion!: string;

  @Column({ name: "tipo_objeto", type: "text" })
  tipo_objeto!: string;

  @Column({ name: "objeto_id", type: "text", nullable: true })
  objeto_id!: string | null;

  @Column({ type: "jsonb", nullable: true })
  antes!: unknown | null;

  @Column({ type: "jsonb", nullable: true })
  despues!: unknown | null;

  @Column({ name: "id_solicitud", type: "text", nullable: true })
  id_solicitud!: string | null;

  @Column({ type: "inet", nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
