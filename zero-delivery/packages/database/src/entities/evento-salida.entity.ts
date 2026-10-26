import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";

/**
 * Entidad Bandeja de Salida (OUTBOX) para efectos secundarios y mensajería a Vocero CRM.
 */
@Entity({ name: "eventos_salida" })
export class EventoSalidaEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ type: "text" })
  tipo!: string;

  @Column({ type: "jsonb" })
  datos!: Record<string, unknown>;

  @Column({ name: "clave_deduplicacion", type: "text", nullable: true, unique: true })
  clave_deduplicacion!: string | null;

  @Column({ type: "text", default: "PENDIENTE" })
  estado!: "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "FALLIDO" | "MUERTO";

  @Column({ type: "integer", default: 0 })
  intentos!: number;

  @Column({ name: "ultimo_error", type: "text", nullable: true })
  ultimo_error!: string | null;

  @Column({ name: "proximo_intento_en", type: "timestamptz", default: () => "now()" })
  proximo_intento_en!: Date;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @Column({ name: "procesado_en", type: "timestamptz", nullable: true })
  procesado_en!: Date | null;
}
