import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { ClienteEntity } from "./cliente.entity";
import { ZonaEntregaEntity } from "./zona-entrega.entity";

@Entity({ name: "direcciones_cliente" })
export class DireccionClienteEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "cliente_id", type: "uuid" })
  cliente_id!: string;

  @ManyToOne(() => ClienteEntity, (cliente) => cliente.direcciones, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cliente_id" })
  cliente?: ClienteEntity;

  @Column({ type: "text", nullable: true })
  etiqueta!: string | null;

  @Column({ name: "texto_direccion", type: "text" })
  texto_direccion!: string;

  @Column({ type: "text", nullable: true })
  referencia!: string | null;

  @Column({ type: "numeric", precision: 9, scale: 6, nullable: true })
  latitud!: number | null;

  @Column({ type: "numeric", precision: 9, scale: 6, nullable: true })
  longitud!: number | null;

  @Column({ name: "zona_id", type: "uuid", nullable: true })
  zona_id!: string | null;

  @ManyToOne(() => ZonaEntregaEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "zona_id" })
  zona?: ZonaEntregaEntity;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;
}
