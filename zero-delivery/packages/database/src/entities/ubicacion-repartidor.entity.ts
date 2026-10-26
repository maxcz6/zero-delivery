import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { RepartidorEntity } from "./repartidor.entity";

@Entity({ name: "ubicaciones_repartidor" })
export class UbicacionRepartidorEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "repartidor_id", type: "uuid" })
  repartidor_id!: string;

  @ManyToOne(() => RepartidorEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "repartidor_id" })
  repartidor?: RepartidorEntity;

  @Column({ name: "pedido_id", type: "uuid", nullable: true })
  pedido_id!: string | null;

  @Column({ type: "numeric", precision: 9, scale: 6 })
  latitud!: number;

  @Column({ type: "numeric", precision: 9, scale: 6 })
  longitud!: number;

  @Column({ name: "precision_m", type: "numeric", precision: 8, scale: 2, nullable: true })
  precision_m!: number | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
