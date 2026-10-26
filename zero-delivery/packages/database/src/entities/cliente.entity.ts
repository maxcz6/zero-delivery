import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Unique } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { UsuarioEntity } from "./usuario.entity";
import { DireccionClienteEntity } from "./direccion-cliente.entity";

@Entity({ name: "clientes" })
@Unique(["inquilino_id", "telefono_e164"])
export class ClienteEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ name: "telefono_e164", type: "text" })
  telefono_e164!: string;

  @Column({ type: "text", nullable: true })
  correo!: string | null;

  @Column({ type: "text", default: "NUEVO" })
  segmento!: "NUEVO" | "RECURRENTE" | "TOP";

  @Column({ name: "marca_riesgo", type: "text", default: "NINGUNO" })
  marca_riesgo!: "NINGUNO" | "PRECAUCION" | "BLOQUEADO";

  @Column({ name: "motivo_riesgo", type: "text", nullable: true })
  motivo_riesgo!: string | null;

  @Column({ name: "riesgo_definido_por", type: "uuid", nullable: true })
  riesgo_definido_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "riesgo_definido_por" })
  usuario_riesgo?: UsuarioEntity;

  @Column({ name: "riesgo_definido_en", type: "timestamptz", nullable: true })
  riesgo_definido_en!: Date | null;

  @Column({ type: "text", nullable: true })
  notas!: string | null;

  @OneToMany(() => DireccionClienteEntity, (dir) => dir.cliente)
  direcciones?: DireccionClienteEntity[];

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
