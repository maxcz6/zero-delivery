import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { GrupoModificadoresEntity } from "./grupo-modificadores.entity";

@Entity({ name: "opciones_modificador" })
export class OpcionModificadorEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "grupo_id", type: "uuid" })
  grupo_id!: string;

  @ManyToOne(() => GrupoModificadoresEntity, (grupo) => grupo.opciones, { onDelete: "CASCADE" })
  @JoinColumn({ name: "grupo_id" })
  grupo?: GrupoModificadoresEntity;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ name: "incremento_precio_centavos", type: "bigint", default: "0" })
  incremento_precio_centavos!: string;

  @Column({ name: "esta_activo", type: "boolean", default: true })
  esta_activo!: boolean;

  @Column({ type: "integer", default: 0 })
  orden!: number;
}
