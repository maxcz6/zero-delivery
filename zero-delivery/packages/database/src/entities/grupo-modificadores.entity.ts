import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RestauranteEntity } from "./restaurante.entity";
import { OpcionModificadorEntity } from "./opcion-modificador.entity";

@Entity({ name: "grupos_modificadores" })
export class GrupoModificadoresEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @Column({ name: "restaurante_id", type: "uuid" })
  restaurante_id!: string;

  @ManyToOne(() => RestauranteEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "restaurante_id" })
  restaurante?: RestauranteEntity;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ name: "minimo_seleccion", type: "smallint", default: 0 })
  minimo_seleccion!: number;

  @Column({ name: "maximo_seleccion", type: "smallint", default: 1 })
  maximo_seleccion!: number;

  @OneToMany(() => OpcionModificadorEntity, (opcion) => opcion.grupo)
  opciones?: OpcionModificadorEntity[];

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
