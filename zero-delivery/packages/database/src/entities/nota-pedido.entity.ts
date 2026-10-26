import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { PedidoEntity } from "./pedido.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "notas_pedido" })
export class NotaPedidoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "pedido_id", type: "uuid" })
  pedido_id!: string;

  @ManyToOne(() => PedidoEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pedido_id" })
  pedido?: PedidoEntity;

  @Column({ name: "autor_id", type: "uuid", nullable: true })
  autor_id!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "autor_id" })
  autor?: UsuarioEntity;

  @Column({ type: "text", default: "NOTA" })
  tipo!: "NOTA" | "INCIDENCIA" | "SISTEMA";

  @Column({ type: "text" })
  contenido!: string;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
