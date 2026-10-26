import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RestauranteEntity } from "./restaurante.entity";

@Entity({ name: "sucursales" })
@Unique(["inquilino_id", "slug"])
export class SucursalEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "restaurante_id", type: "uuid" })
  restaurante_id!: string;

  @ManyToOne(() => RestauranteEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "restaurante_id" })
  restaurante?: RestauranteEntity;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ type: "text" })
  slug!: string;

  @Column({ type: "text" })
  direccion!: string;

  @Column({ type: "numeric", precision: 9, scale: 6, nullable: true })
  latitud!: number | null;

  @Column({ type: "numeric", precision: 9, scale: 6, nullable: true })
  longitud!: number | null;

  @Column({ type: "text", nullable: true })
  telefono!: string | null;

  @Column({ name: "apertura_manual", type: "boolean", default: true })
  apertura_manual!: boolean;

  @Column({ name: "esta_activo", type: "boolean", default: true })
  esta_activo!: boolean;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
