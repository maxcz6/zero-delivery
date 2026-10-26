import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
  VersionColumn,
} from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { SucursalEntity } from "./sucursal.entity";
import { ClienteEntity } from "./cliente.entity";
import { RepartidorEntity } from "./repartidor.entity";
import { ZonaEntregaEntity } from "./zona-entrega.entity";
import { UsuarioEntity } from "./usuario.entity";
import { DetallePedidoEntity } from "./detalle-pedido.entity";
import { EstadoOperativoPedidoDb, EstadoPagoDb, MetodoPagoDb } from "@zero-delivery/shared-types";

@Entity({ name: "pedidos" })
@Unique(["inquilino_id", "numero"])
export class PedidoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ type: "bigint", default: "0" })
  numero!: string;

  @Column({ name: "sucursal_id", type: "uuid" })
  sucursal_id!: string;

  @ManyToOne(() => SucursalEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "sucursal_id" })
  sucursal?: SucursalEntity;

  @Column({ name: "cliente_id", type: "uuid" })
  cliente_id!: string;

  @ManyToOne(() => ClienteEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "cliente_id" })
  cliente?: ClienteEntity;

  @Column({ type: "jsonb" })
  direccion_snapshot!: Record<string, unknown>;

  @Column({ type: "text", default: "MANUAL" })
  canal!: "MANUAL" | "WEB" | "WHATSAPP" | "CRM";

  @Column({ type: "text", default: "NUEVO" })
  estado_operativo!: EstadoOperativoPedidoDb;

  @Column({ type: "text", default: "PENDIENTE" })
  estado_pago!: EstadoPagoDb;

  @Column({ type: "text" })
  metodo_pago!: MetodoPagoDb;

  @Column({ type: "text", default: "PENDIENTE" })
  estado_pago_restaurante!: "PENDIENTE" | "CONFIRMADO";

  @Column({ name: "traspaso_en", type: "timestamptz", nullable: true })
  traspaso_en!: Date | null;

  @Column({ name: "traspaso_por", type: "uuid", nullable: true })
  traspaso_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "traspaso_por" })
  usuario_traspaso?: UsuarioEntity;

  @Column({ name: "liberado_en", type: "timestamptz", nullable: true })
  liberado_en!: Date | null;

  @Column({ name: "liberado_por", type: "uuid", nullable: true })
  liberado_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "liberado_por" })
  usuario_liberador?: UsuarioEntity;

  @Column({ name: "repartidor_id", type: "uuid", nullable: true })
  repartidor_id!: string | null;

  @ManyToOne(() => RepartidorEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "repartidor_id" })
  repartidor?: RepartidorEntity;

  @Column({ name: "zona_entrega_id", type: "uuid", nullable: true })
  zona_entrega_id!: string | null;

  @ManyToOne(() => ZonaEntregaEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "zona_entrega_id" })
  zona_entrega?: ZonaEntregaEntity;

  @Column({ name: "cantidad_intentos", type: "smallint", default: 0 })
  cantidad_intentos!: number;

  @Column({ name: "estado_previo_solicitud_cancelacion", type: "text", nullable: true })
  estado_previo_solicitud_cancelacion!: string | null;

  @Column({ type: "text", nullable: true })
  resolucion!: string | null;

  @Column({ name: "subtotal_items_centavos", type: "bigint" })
  subtotal_items_centavos!: string;

  @Column({ name: "descuento_centavos", type: "bigint", default: "0" })
  descuento_centavos!: string;

  @Column({ name: "tarifa_entrega_centavos", type: "bigint", default: "0" })
  tarifa_entrega_centavos!: string;

  @Column({ name: "impuesto_centavos", type: "bigint", default: "0" })
  impuesto_centavos!: string;

  @Column({ name: "total_centavos", type: "bigint" })
  total_centavos!: string;

  @Column({ name: "efectivo_por_cobrar_centavos", type: "bigint", default: "0" })
  efectivo_por_cobrar_centavos!: string;

  @Column({ name: "factura_solicitada", type: "boolean", default: false })
  factura_solicitada!: boolean;

  @Column({ name: "token_publico", type: "text", unique: true })
  token_publico!: string;

  @Column({ name: "clave_idempotencia", type: "text", nullable: true })
  clave_idempotencia!: string | null;

  @Column({ type: "text", nullable: true })
  notas!: string | null;

  @VersionColumn({ default: 1 })
  version!: number;

  @Column({ name: "creado_por", type: "uuid", nullable: true })
  creado_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "creado_por" })
  usuario_creador?: UsuarioEntity;

  @OneToMany(() => DetallePedidoEntity, (detalle) => detalle.pedido)
  items?: DetallePedidoEntity[];

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
