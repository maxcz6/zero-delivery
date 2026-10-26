import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "sesiones" })
export class SesionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "usuario_id", type: "uuid" })
  usuario_id!: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "usuario_id" })
  usuario?: UsuarioEntity;

  @Column({ name: "hash_token", type: "text", unique: true })
  hash_token!: string;

  @Column({ name: "expira_en", type: "timestamptz" })
  expira_en!: Date;

  @Column({ name: "revocado_en", type: "timestamptz", nullable: true })
  revocado_en!: Date | null;

  @Column({ type: "inet", nullable: true })
  ip!: string | null;

  @Column({ name: "agente_usuario", type: "text", nullable: true })
  agente_usuario!: string | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
