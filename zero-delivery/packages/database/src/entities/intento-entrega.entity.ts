import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RepartidorEntity } from "./repartidor.entity";
import { ArchivoEntity } from "./archivo.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "intentos_entrega" })
@Unique(["pedido_id", "numero_intento"])
export class IntentoEntregaEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "pedido_id", type: "uuid" })
  pedido_id!: string;

  @Column({ name: "numero_intento", type: "smallint" })
  numero_intento!: number;

  @Column({ name: "repartidor_id", type: "uuid" })
  repartidor_id!: string;

  @ManyToOne(() => RepartidorEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "repartidor_id" })
  repartidor?: RepartidorEntity;

  @Column({ type: "text", default: "EN_PROGRESO" })
  resultado!: "EN_PROGRESO" | "ENTREGADO" | "FALLIDO";

  @Column({ name: "motivo_fallo", type: "text", nullable: true })
  motivo_fallo!: string | null;

  @Column({ type: "text", nullable: true })
  notas!: string | null;

  @Column({ name: "archivo_evidencia_id", type: "uuid", nullable: true })
  archivo_evidencia_id!: string | null;

  @ManyToOne(() => ArchivoEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "archivo_evidencia_id" })
  archivo_evidencia?: ArchivoEntity;

  @Column({ name: "efectivo_cobrado_centavos", type: "bigint", nullable: true })
  efectivo_cobrado_centavos!: string | null;

  @Column({ name: "autorizado_por", type: "uuid", nullable: true })
  autorizado_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "autorizado_por" })
  usuario_autorizador?: UsuarioEntity;

  @Column({ name: "iniciado_en", type: "timestamptz" })
  iniciado_en!: Date;

  @Column({ name: "finalizado_en", type: "timestamptz", nullable: true })
  finalizado_en!: Date | null;
}
