import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { PedidoEntity } from "./pedido.entity";
import { PagoEntity } from "./pago.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "reembolsos" })
export class ReembolsoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "pedido_id", type: "uuid" })
  pedido_id!: string;

  @ManyToOne(() => PedidoEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pedido_id" })
  pedido?: PedidoEntity;

  @Column({ name: "pago_id", type: "uuid", nullable: true })
  pago_id!: string | null;

  @ManyToOne(() => PagoEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "pago_id" })
  pago?: PagoEntity;

  @Column({ name: "monto_centavos", type: "bigint" })
  monto_centavos!: string;

  @Column({ type: "text" })
  motivo!: string;

  @Column({ name: "autorizado_por", type: "uuid" })
  autorizado_por!: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "autorizado_por" })
  usuario_autorizador?: UsuarioEntity;

  @Column({ type: "text", nullable: true })
  metodo!: string | null;

  @Column({ type: "text", nullable: true })
  referencia!: string | null;

  @Column({ name: "confirmado_en", type: "timestamptz", nullable: true })
  confirmado_en!: Date | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
