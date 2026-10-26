import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { PagoEntity } from "./pago.entity";
import { UsuarioEntity } from "./usuario.entity";

/**
 * Entidad de Bitácora de Eventos de Pago (SOLO INSERCIÓN / APPEND-ONLY).
 * El trigger de base de datos prohíbe cualquier mutación (UPDATE/DELETE).
 */
@Entity({ name: "eventos_pago" })
export class EventoPagoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "pago_id", type: "uuid" })
  pago_id!: string;

  @ManyToOne(() => PagoEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pago_id" })
  pago?: PagoEntity;

  @Column({ type: "text" })
  tipo!: "CREADO" | "VALIDADO" | "RECHAZADO" | "CORREGIDO" | "REEMBOLSADO";

  @Column({ type: "jsonb", nullable: true })
  antes!: unknown | null;

  @Column({ type: "jsonb", nullable: true })
  despues!: unknown | null;

  @Column({ type: "text", nullable: true })
  motivo!: string | null;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actor_id!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "actor_id" })
  actor?: UsuarioEntity;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
