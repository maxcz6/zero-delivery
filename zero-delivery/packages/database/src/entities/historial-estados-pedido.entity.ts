import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { PedidoEntity } from "./pedido.entity";
import { UsuarioEntity } from "./usuario.entity";

/**
 * Entidad de Historial de Estados del Pedido (SOLO INSERCIÓN / APPEND-ONLY).
 * El trigger de base de datos prohíbe cualquier mutación (UPDATE/DELETE).
 */
@Entity({ name: "historial_estados_pedido" })
export class HistorialEstadosPedidoEntity {
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

  @Column({ name: "estado_anterior", type: "text", nullable: true })
  estado_anterior!: string | null;

  @Column({ name: "estado_nuevo", type: "text" })
  estado_nuevo!: string;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actor_id!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "actor_id" })
  actor?: UsuarioEntity;

  @Column({ name: "rol_actor", type: "text", nullable: true })
  rol_actor!: string | null;

  @Column({ type: "text", nullable: true })
  motivo!: string | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
