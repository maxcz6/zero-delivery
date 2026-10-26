import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RepartidorEntity } from "./repartidor.entity";
import { UsuarioEntity } from "./usuario.entity";
import { LiquidacionEntity } from "./liquidacion.entity";

@Entity({ name: "adelantos_repartidor" })
export class AdelantoRepartidorEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "repartidor_id", type: "uuid" })
  repartidor_id!: string;

  @ManyToOne(() => RepartidorEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "repartidor_id" })
  repartidor?: RepartidorEntity;

  @Column({ name: "monto_centavos", type: "bigint" })
  monto_centavos!: string;

  @Column({ type: "text", default: "COMBUSTIBLE" })
  proposito!: string;

  @Column({ name: "autorizado_por", type: "uuid" })
  autorizado_por!: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "autorizado_por" })
  usuario_autorizador?: UsuarioEntity;

  @Column({ type: "text", default: "PENDIENTE_DEDUCCION" })
  estado!: "PENDIENTE_DEDUCCION" | "DEDUCIDO";

  @Column({ name: "deducido_en_liquidacion_id", type: "uuid", nullable: true })
  deducido_en_liquidacion_id!: string | null;

  @ManyToOne(() => LiquidacionEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "deducido_en_liquidacion_id" })
  liquidacion?: LiquidacionEntity;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
