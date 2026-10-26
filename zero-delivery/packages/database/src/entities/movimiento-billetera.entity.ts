import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RepartidorEntity } from "./repartidor.entity";
import { PedidoEntity } from "./pedido.entity";
import { AdelantoRepartidorEntity } from "./adelanto-repartidor.entity";
import { LiquidacionEntity } from "./liquidacion.entity";
import { UsuarioEntity } from "./usuario.entity";
import { TipoMovimientoBilleteraDb } from "@zero-delivery/shared-types";

/**
 * Entidad Libro Mayor de Garantía / Billetera (SOLO INSERCIÓN / APPEND-ONLY).
 * El trigger de base de datos prohíbe cualquier mutación (UPDATE/DELETE).
 * El saldo NUNCA se almacena; se deriva sumando monto_centavos.
 */
@Entity({ name: "movimientos_billetera" })
export class MovimientoBilleteraEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "repartidor_id", type: "uuid" })
  repartidor_id!: string;

  @ManyToOne(() => RepartidorEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "repartidor_id" })
  repartidor?: RepartidorEntity;

  @Column({ type: "text" })
  tipo!: TipoMovimientoBilleteraDb;

  @Column({ name: "monto_centavos", type: "bigint" })
  monto_centavos!: string;

  @Column({ name: "pedido_id", type: "uuid", nullable: true })
  pedido_id!: string | null;

  @ManyToOne(() => PedidoEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "pedido_id" })
  pedido?: PedidoEntity;

  @Column({ name: "adelanto_id", type: "uuid", nullable: true })
  adelanto_id!: string | null;

  @ManyToOne(() => AdelantoRepartidorEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "adelanto_id" })
  adelanto?: AdelantoRepartidorEntity;

  @Column({ name: "liquidacion_id", type: "uuid", nullable: true })
  liquidacion_id!: string | null;

  @ManyToOne(() => LiquidacionEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "liquidacion_id" })
  liquidacion?: LiquidacionEntity;

  @Column({ type: "text", nullable: true })
  motivo!: string | null;

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actor_id!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "actor_id" })
  actor?: UsuarioEntity;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
