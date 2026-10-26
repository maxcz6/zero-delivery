import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";

@Entity({ name: "restaurantes" })
export class RestauranteEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ name: "razon_social", type: "text", nullable: true })
  razon_social!: string | null;

  @Column({ type: "text", nullable: true })
  ruc!: string | null;

  @Column({ name: "esta_activo", type: "boolean", default: true })
  esta_activo!: boolean;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
