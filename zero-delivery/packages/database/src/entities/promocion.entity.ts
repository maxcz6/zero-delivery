import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RestauranteEntity } from "./restaurante.entity";
import { SucursalEntity } from "./sucursal.entity";
import { UsuarioEntity } from "./usuario.entity";

/**
 * Promoción comercial (descuento, cupón o combo) de un inquilino.
 * Tabla `promociones`; sus condiciones viven en `reglas_promocion`.
 */
@Entity({ name: "promociones" })
export class PromocionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "restaurante_id", type: "uuid", nullable: true })
  restaurante_id!: string | null;

  @ManyToOne(() => RestauranteEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "restaurante_id" })
  restaurante?: RestauranteEntity;

  @Column({ name: "sucursal_id", type: "uuid", nullable: true })
  sucursal_id!: string | null;

  @ManyToOne(() => SucursalEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "sucursal_id" })
  sucursal?: SucursalEntity;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ type: "text" })
  tipo!: "DESCUENTO" | "CUPON" | "COMBO";

  @Column({ type: "text", nullable: true })
  codigo!: string | null;

  @Column({ name: "inicia_en", type: "timestamptz", nullable: true })
  inicia_en!: Date | null;

  @Column({ name: "termina_en", type: "timestamptz", nullable: true })
  termina_en!: Date | null;

  @Column({ name: "esta_activa", type: "boolean", default: false })
  esta_activa!: boolean;

  @Column({ name: "creado_por", type: "uuid", nullable: true })
  creado_por!: string | null;

  @ManyToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "creado_por" })
  usuario_creador?: UsuarioEntity;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
