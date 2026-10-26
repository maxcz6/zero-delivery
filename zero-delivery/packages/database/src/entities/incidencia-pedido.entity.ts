import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { PedidoEntity } from "./pedido.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "incidencias_pedido" })
export class IncidenciaPedidoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "pedido_id", type: "uuid" })
  pedido_id!: string;

  @ManyToOne(() => PedidoEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pedido_id" })
  pedido?: PedidoEntity;

  @Column({ type: "text" })
  tipo!: string;

  @Column({ type: "text" })
  descripcion!: string;

  @Column({ name: "ids_archivos_evidencia", type: "uuid", array: true, default: "{}" })
  ids_archivos_evidencia!: string[];

  @Column({ name: "revisor_id", type: "uuid", nullable: true })
  revisor_id!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "revisor_id" })
  revisor?: UsuarioEntity;

  @Column({ type: "text", nullable: true })
  decision!: string | null;

  @Column({ name: "monto_centavos", type: "bigint", nullable: true })
  monto_centavos!: string | null;

  @Column({ type: "text", nullable: true })
  justificacion!: string | null;

  @Column({ type: "text", default: "ABIERTA" })
  estado!: "ABIERTA" | "EN_REVISION" | "DECIDIDA" | "CERRADA";

  @Column({ name: "creado_por", type: "uuid", nullable: true })
  creado_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "creado_por" })
  creador?: UsuarioEntity;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
