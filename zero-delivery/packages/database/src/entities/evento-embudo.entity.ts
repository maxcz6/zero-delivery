import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { SucursalEntity } from "./sucursal.entity";

@Entity({ name: "eventos_embudo" })
export class EventoEmbudoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "sucursal_id", type: "uuid", nullable: true })
  sucursal_id!: string | null;

  @ManyToOne(() => SucursalEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "sucursal_id" })
  sucursal?: SucursalEntity;

  @Column({ name: "id_sesion", type: "text" })
  id_sesion!: string;

  @Column({ type: "text" })
  paso!: "IMPRESION" | "VISTA_CARTA" | "AGREGAR_AL_CARRITO" | "COMPRA";

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
