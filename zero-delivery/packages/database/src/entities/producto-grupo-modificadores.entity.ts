import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { ProductoEntity } from "./producto.entity";
import { GrupoModificadoresEntity } from "./grupo-modificadores.entity";

@Entity({ name: "productos_grupos_modificadores" })
export class ProductoGrupoModificadoresEntity {
  @PrimaryColumn({ name: "producto_id", type: "uuid" })
  producto_id!: string;

  @ManyToOne(() => ProductoEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "producto_id" })
  producto?: ProductoEntity;

  @PrimaryColumn({ name: "grupo_id", type: "uuid" })
  grupo_id!: string;

  @ManyToOne(() => GrupoModificadoresEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "grupo_id" })
  grupo?: GrupoModificadoresEntity;
}
