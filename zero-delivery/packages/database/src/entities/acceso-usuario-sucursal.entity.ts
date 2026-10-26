import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { UsuarioEntity } from "./usuario.entity";
import { SucursalEntity } from "./sucursal.entity";

@Entity({ name: "acceso_usuario_sucursal" })
export class AccesoUsuarioSucursalEntity {
  @PrimaryColumn({ name: "usuario_id", type: "uuid" })
  usuario_id!: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "usuario_id" })
  usuario?: UsuarioEntity;

  @PrimaryColumn({ name: "sucursal_id", type: "uuid" })
  sucursal_id!: string;

  @ManyToOne(() => SucursalEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sucursal_id" })
  sucursal?: SucursalEntity;
}
