import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { SucursalEntity } from "./sucursal.entity";

@Entity({ name: "zonas_entrega" })
@Unique(["sucursal_id", "nombre"])
export class ZonaEntregaEntity {
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

  @Column({ name: "tarifa_centavos", type: "bigint", default: "0" })
  tarifa_centavos!: string;

  @Column({ name: "pedido_minimo_centavos", type: "bigint", default: "0" })
  pedido_minimo_centavos!: string;

  @Column({ name: "radio_km", type: "numeric", precision: 6, scale: 2, nullable: true })
  radio_km!: number | null;

  @Column({ name: "esta_activo", type: "boolean", default: true })
  esta_activo!: boolean;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
