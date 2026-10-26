import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { PedidoEntity } from "./pedido.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "pagos_restaurante" })
export class PagoRestauranteEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "pedido_id", type: "uuid", unique: true })
  pedido_id!: string;

  @OneToOne(() => PedidoEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "pedido_id" })
  pedido?: PedidoEntity;

  @Column({ name: "monto_centavos", type: "bigint" })
  monto_centavos!: string;

  @Column({ type: "text", default: "PENDIENTE" })
  estado!: "PENDIENTE" | "CONFIRMADO";

  @Column({ type: "text", nullable: true })
  metodo!: string | null;

  @Column({ type: "text", nullable: true })
  referencia!: string | null;

  @Column({ name: "confirmado_por", type: "uuid", nullable: true })
  confirmado_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "confirmado_por" })
  usuario_confirmador?: UsuarioEntity;

  @Column({ name: "confirmado_en", type: "timestamptz", nullable: true })
  confirmado_en!: Date | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
