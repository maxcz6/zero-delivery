import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RestauranteEntity } from "./restaurante.entity";

@Entity({ name: "categorias" })
@Unique(["restaurante_id", "nombre"])
export class CategoriaEntity {
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

  @Column({ type: "integer", default: 0 })
  orden!: number;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
