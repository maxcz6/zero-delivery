import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RepartidorEntity } from "./repartidor.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "liquidaciones" })
@Unique(["repartidor_id", "fecha_operativa"])
export class LiquidacionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "repartidor_id", type: "uuid" })
  repartidor_id!: string;

  @ManyToOne(() => RepartidorEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "repartidor_id" })
  repartidor?: RepartidorEntity;

  @Column({ name: "fecha_operativa", type: "date" })
  fecha_operativa!: string;

  @Column({ name: "corte_en", type: "timestamptz" })
  corte_en!: Date;

  @Column({ name: "efectivo_cobrado_centavos", type: "bigint", default: "0" })
  efectivo_cobrado_centavos!: string;

  @Column({ name: "efectivo_recibido_centavos", type: "bigint", default: "0" })
  efectivo_recibido_centavos!: string;

  @Column({ name: "adelantos_deducidos_centavos", type: "bigint", default: "0" })
  adelantos_deducidos_centavos!: string;

  @Column({ name: "tarifa_repartidor_referencia_centavos", type: "bigint", default: "0" })
  tarifa_repartidor_referencia_centavos!: string;

  @Column({ name: "tarifa_repartidor_pagable_centavos", type: "bigint", default: "0" })
  tarifa_repartidor_pagable_centavos!: string;

  @Column({ name: "motivo_ajuste_tarifa_repartidor", type: "text", nullable: true })
  motivo_ajuste_tarifa_repartidor!: string | null;

  @Column({ name: "neto_centavos", type: "bigint", default: "0" })
  neto_centavos!: string;

  @Column({ type: "text", default: "BORRADOR" })
  estado!: "BORRADOR" | "CONFIRMADO";

  @Column({ name: "confirmado_por", type: "uuid", nullable: true })
  confirmado_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "confirmado_por" })
  usuario_confirmador?: UsuarioEntity;

  @Column({ name: "confirmado_en", type: "timestamptz", nullable: true })
  confirmado_en!: Date | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
