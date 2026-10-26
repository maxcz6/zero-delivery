import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Unique, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";

@Entity({ name: "configuraciones" })
@Unique(["inquilino_id", "clave"])
export class ConfiguracionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ type: "text" })
  clave!: string;

  @Column({ type: "jsonb" })
  valor!: unknown;

  @Column({ name: "es_marcador", type: "boolean", default: false })
  es_marcador!: boolean;

  @Column({ name: "actualizado_por", type: "uuid", nullable: true })
  actualizado_por!: string | null;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
