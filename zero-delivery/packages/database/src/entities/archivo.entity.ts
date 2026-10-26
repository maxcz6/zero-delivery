import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "archivos" })
export class ArchivoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "clave_almacenamiento", type: "text" })
  clave_almacenamiento!: string;

  @Column({ name: "tipo_mime", type: "text" })
  tipo_mime!: string;

  @Column({ name: "tamano_bytes", type: "bigint" })
  tamano_bytes!: string;

  @Column({ name: "subido_por", type: "uuid", nullable: true })
  subido_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "subido_por" })
  usuario?: UsuarioEntity;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
