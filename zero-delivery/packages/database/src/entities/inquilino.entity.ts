import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "inquilinos" })
export class InquilinoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ type: "text", unique: true })
  slug!: string;

  @Column({ type: "text", default: "ACTIVO" })
  estado!: "ACTIVO" | "SUSPENDIDO";

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
