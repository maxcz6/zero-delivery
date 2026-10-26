import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { CartaEntity } from "./carta.entity";
import { ProductoEntity } from "./producto.entity";

@Entity({ name: "items_carta" })
@Unique(["carta_id", "producto_id"])
export class ItemCartaEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "carta_id", type: "uuid" })
  carta_id!: string;

  @ManyToOne(() => CartaEntity, (carta) => carta.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "carta_id" })
  carta?: CartaEntity;

  @Column({ name: "producto_id", type: "uuid" })
  producto_id!: string;

  @ManyToOne(() => ProductoEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "producto_id" })
  producto?: ProductoEntity;

  @Column({ name: "precio_centavos", type: "bigint" })
  precio_centavos!: string;

  @Column({ name: "esta_disponible", type: "boolean", default: true })
  esta_disponible!: boolean;

  @Column({ type: "integer", default: 0 })
  orden!: number;
}
