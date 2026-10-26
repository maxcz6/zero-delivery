import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { SucursalEntity } from "./sucursal.entity";
import { ItemCartaEntity } from "./item-carta.entity";

@Entity({ name: "cartas" })
export class CartaEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "sucursal_id", type: "uuid" })
  sucursal_id!: string;

  @ManyToOne(() => SucursalEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sucursal_id" })
  sucursal?: SucursalEntity;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ name: "es_predeterminada", type: "boolean", default: false })
  es_predeterminada!: boolean;

  @Column({ name: "incluye_entrega_en_precio", type: "boolean", default: false })
  incluye_entrega_en_precio!: boolean;

  @Column({ name: "incluye_impuesto_en_precio", type: "boolean", default: false })
  incluye_impuesto_en_precio!: boolean;

  @Column({ type: "jsonb", nullable: true })
  horario!: unknown | null;

  @Column({ name: "esta_activa", type: "boolean", default: true })
  esta_activa!: boolean;

  @OneToMany(() => ItemCartaEntity, (item) => item.carta)
  items?: ItemCartaEntity[];

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
