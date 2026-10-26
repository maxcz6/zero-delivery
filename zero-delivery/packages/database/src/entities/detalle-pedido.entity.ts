import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { PedidoEntity } from "./pedido.entity";
import { ProductoEntity } from "./producto.entity";
import { ModificadorDetallePedidoEntity } from "./modificador-detalle-pedido.entity";

@Entity({ name: "detalle_pedido" })
export class DetallePedidoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "pedido_id", type: "uuid" })
  pedido_id!: string;

  @ManyToOne(() => PedidoEntity, (pedido) => pedido.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pedido_id" })
  pedido?: PedidoEntity;

  @Column({ name: "producto_id", type: "uuid" })
  producto_id!: string;

  @ManyToOne(() => ProductoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "producto_id" })
  producto?: ProductoEntity;

  @Column({ name: "nombre_snapshot", type: "text" })
  nombre_snapshot!: string;

  @Column({ type: "integer" })
  cantidad!: number;

  @Column({ name: "precio_base_centavos", type: "bigint" })
  precio_base_centavos!: string;

  @Column({ name: "empaque_centavos", type: "bigint", default: "0" })
  empaque_centavos!: string;

  @Column({ name: "margen_centavos", type: "bigint", default: "0" })
  margen_centavos!: string;

  @Column({ name: "precio_unitario_centavos", type: "bigint" })
  precio_unitario_centavos!: string;

  @Column({ name: "total_linea_centavos", type: "bigint" })
  total_linea_centavos!: string;

  @Column({ type: "text", default: "ACTIVO" })
  estado!: "ACTIVO" | "NO_DISPONIBLE" | "REEMPLAZADO" | "CANCELADO";

  @Column({ name: "motivo_no_disponible", type: "text", nullable: true })
  motivo_no_disponible!: string | null;

  @Column({ name: "reemplazo_de_item_id", type: "uuid", nullable: true })
  reemplazo_de_item_id!: string | null;

  @Column({ name: "decision_cliente", type: "text", nullable: true })
  decision_cliente!: "REEMPLAZO_ACEPTADO" | "ITEM_CANCELADO" | null;

  @Column({ name: "decision_cliente_en", type: "timestamptz", nullable: true })
  decision_cliente_en!: Date | null;

  @OneToMany(() => ModificadorDetallePedidoEntity, (mod) => mod.detalle_pedido)
  modificadores?: ModificadorDetallePedidoEntity[];

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
