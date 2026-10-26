import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { PedidoEntity } from "./pedido.entity";
import { RepartidorEntity } from "./repartidor.entity";
import { SucursalEntity } from "./sucursal.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "alertas" })
@Unique(["inquilino_id", "clave_deduplicacion"])
export class AlertaEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ type: "text" })
  tipo!: string;

  @Column({ type: "text", default: "INFO" })
  severidad!: "INFO" | "ADVERTENCIA" | "CRITICO";

  @Column({ name: "pedido_id", type: "uuid", nullable: true })
  pedido_id!: string | null;

  @ManyToOne(() => PedidoEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "pedido_id" })
  pedido?: PedidoEntity;

  @Column({ name: "repartidor_id", type: "uuid", nullable: true })
  repartidor_id!: string | null;

  @ManyToOne(() => RepartidorEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "repartidor_id" })
  repartidor?: RepartidorEntity;

  @Column({ name: "sucursal_id", type: "uuid", nullable: true })
  sucursal_id!: string | null;

  @ManyToOne(() => SucursalEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "sucursal_id" })
  sucursal?: SucursalEntity;

  @Column({ type: "jsonb", default: {} })
  datos!: Record<string, unknown>;

  @Column({ name: "clave_deduplicacion", type: "text" })
  clave_deduplicacion!: string;

  @Column({ type: "text", default: "ABIERTA" })
  estado!: "ABIERTA" | "RECONOCIDA" | "RESUELTA";

  @Column({ name: "reconocido_por", type: "uuid", nullable: true })
  reconocido_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "reconocido_por" })
  usuario_reconocedor?: UsuarioEntity;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @Column({ name: "resuelto_en", type: "timestamptz", nullable: true })
  resuelto_en!: Date | null;
}
