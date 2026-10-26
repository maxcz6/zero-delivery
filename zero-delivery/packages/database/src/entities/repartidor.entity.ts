import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { UsuarioEntity } from "./usuario.entity";

@Entity({ name: "repartidores" })
export class RepartidorEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "usuario_id", type: "uuid", nullable: true, unique: true })
  usuario_id!: string | null;

  @OneToOne(() => UsuarioEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "usuario_id" })
  usuario?: UsuarioEntity;

  @Column({ name: "nombre_completo", type: "text" })
  nombre_completo!: string;

  @Column({ type: "text" })
  telefono!: string;

  @Column({ name: "fecha_nacimiento", type: "date" })
  fecha_nacimiento!: string;

  @Column({ name: "tipo_flota", type: "text" })
  tipo_flota!: "PROPIO" | "AGENCIA" | "TERCERO";

  @Column({ name: "nombre_agencia", type: "text", nullable: true })
  nombre_agencia!: string | null;

  @Column({ name: "tipo_vehiculo", type: "text" })
  tipo_vehiculo!: "MOTO" | "AUTO";

  @Column({ type: "text", default: "DESCONECTADO" })
  estado!: "DISPONIBLE" | "OCUPADO" | "EN_CAMINO" | "DESCONECTADO";

  @Column({ name: "alta_confianza", type: "boolean", default: false })
  alta_confianza!: boolean;

  @Column({ name: "puntaje_confianza", type: "numeric", precision: 5, scale: 2, nullable: true })
  puntaje_confianza!: number | null;

  @Column({ name: "esta_activo", type: "boolean", default: true })
  esta_activo!: boolean;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
