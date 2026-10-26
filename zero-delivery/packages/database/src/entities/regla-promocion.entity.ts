import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { PromocionEntity } from "./promocion.entity";

/**
 * Regla de aplicación de una promoción. Tabla `reglas_promocion`.
 * El JSON es libre a propósito: cada tipo de promoción define sus condiciones.
 */
@Entity({ name: "reglas_promocion" })
export class ReglaPromocionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "promocion_id", type: "uuid" })
  promocion_id!: string;

  @ManyToOne(() => PromocionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "promocion_id" })
  promocion?: PromocionEntity;

  @Column({ type: "jsonb" })
  regla!: Record<string, unknown>;
}
