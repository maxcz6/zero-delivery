import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { DetallePedidoEntity } from "./detalle-pedido.entity";

@Entity({ name: "modificadores_detalle_pedido" })
export class ModificadorDetallePedidoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "detalle_pedido_id", type: "uuid" })
  detalle_pedido_id!: string;

  @ManyToOne(() => DetallePedidoEntity, (detalle) => detalle.modificadores, { onDelete: "CASCADE" })
  @JoinColumn({ name: "detalle_pedido_id" })
  detalle_pedido?: DetallePedidoEntity;

  @Column({ name: "nombre_snapshot", type: "text" })
  nombre_snapshot!: string;

  @Column({ name: "incremento_precio_centavos", type: "bigint", default: "0" })
  incremento_precio_centavos!: string;
}
