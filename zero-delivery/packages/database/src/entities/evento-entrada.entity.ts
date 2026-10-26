import { Entity, PrimaryGeneratedColumn, Column, Unique } from "typeorm";

/**
 * Entidad Webhooks Entrantes (INBOX) para recepción idempotente desde Vocero CRM.
 * El trigger guardia_eventos_entrada prohíbe DELETE y solo permite mutar estado, procesado_en, error e intentos.
 */
@Entity({ name: "eventos_entrada" })
@Unique(["proveedor", "id_evento_externo"])
export class EventoEntradaEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  proveedor!: string;

  @Column({ name: "id_evento_externo", type: "text" })
  id_evento_externo!: string;

  @Column({ type: "jsonb" })
  datos!: Record<string, unknown>;

  @Column({ type: "text", default: "RECIBIDO" })
  estado!: "RECIBIDO" | "PROCESADO" | "FALLIDO" | "IGNORADO";

  @Column({ type: "integer", default: 0 })
  intentos!: number;

  @Column({ type: "text", nullable: true })
  error!: string | null;

  @Column({ name: "recibido_en", type: "timestamptz", default: () => "now()" })
  recibido_en!: Date;

  @Column({ name: "procesado_en", type: "timestamptz", nullable: true })
  procesado_en!: Date | null;
}
