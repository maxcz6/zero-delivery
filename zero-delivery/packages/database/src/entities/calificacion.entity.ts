import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { PedidoEntity } from "./pedido.entity";

/**
 * Calificación de un pedido (restaurante, repartidor o cliente).
 * Tabla `calificaciones`: única por (pedido, sujeto, tipo de calificador).
 */
@Entity({ name: "calificaciones" })
@Unique(["pedido_id", "tipo_sujeto", "tipo_calificador"])
export class CalificacionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "pedido_id", type: "uuid" })
  pedido_id!: string;

  @ManyToOne(() => PedidoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "pedido_id" })
  pedido?: PedidoEntity;

  @Column({ name: "tipo_sujeto", type: "text" })
  tipo_sujeto!: "RESTAURANTE" | "REPARTIDOR" | "CLIENTE";

  @Column({ name: "sujeto_id", type: "uuid" })
  sujeto_id!: string;

  @Column({ name: "tipo_calificador", type: "text" })
  tipo_calificador!: "CLIENTE" | "REPARTIDOR" | "PERSONAL";

  @Column({ type: "smallint" })
  estrellas!: number;

  @Column({ type: "text", nullable: true })
  comentario!: string | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
