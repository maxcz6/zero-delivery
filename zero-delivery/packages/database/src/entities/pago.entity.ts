import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { PedidoEntity } from "./pedido.entity";
import { ArchivoEntity } from "./archivo.entity";
import { UsuarioEntity } from "./usuario.entity";
import { EstadoPagoDb, MetodoPagoDb } from "@zero-delivery/shared-types";

@Entity({ name: "pagos" })
export class PagoEntity {
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

  @Column({ type: "text" })
  metodo!: MetodoPagoDb;

  @Column({ name: "monto_centavos", type: "bigint" })
  monto_centavos!: string;

  @Column({ type: "text", default: "PENDIENTE" })
  estado!: EstadoPagoDb;

  @Column({ name: "archivo_comprobante_id", type: "uuid", nullable: true })
  archivo_comprobante_id!: string | null;

  @ManyToOne(() => ArchivoEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "archivo_comprobante_id" })
  archivo_comprobante?: ArchivoEntity;

  @Column({ type: "text", nullable: true })
  referencia!: string | null;

  @Column({ name: "validado_por", type: "uuid", nullable: true })
  validado_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "validado_por" })
  usuario_validador?: UsuarioEntity;

  @Column({ name: "validado_en", type: "timestamptz", nullable: true })
  validado_en!: Date | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
