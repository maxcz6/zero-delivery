import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { SucursalEntity } from "./sucursal.entity";

@Entity({ name: "horarios_sucursal" })
@Unique(["sucursal_id", "dia_semana", "numero_turno"])
export class HorarioSucursalEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "sucursal_id", type: "uuid" })
  sucursal_id!: string;

  @ManyToOne(() => SucursalEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sucursal_id" })
  sucursal?: SucursalEntity;

  @Column({ name: "dia_semana", type: "smallint" })
  dia_semana!: number; // 0 = Domingo

  @Column({ name: "numero_turno", type: "smallint", default: 1 })
  numero_turno!: number;

  @Column({ name: "abre_a", type: "time" })
  abre_a!: string;

  @Column({ name: "cierra_a", type: "time" })
  cierra_a!: string;
}
