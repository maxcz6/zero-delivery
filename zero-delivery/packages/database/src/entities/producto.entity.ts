import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";
import { RestauranteEntity } from "./restaurante.entity";
import { CategoriaEntity } from "./categoria.entity";
import { ArchivoEntity } from "./archivo.entity";

@Entity({ name: "productos" })
export class ProductoEntity {
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

  @Column({ name: "categoria_id", type: "uuid", nullable: true })
  categoria_id!: string | null;

  @ManyToOne(() => CategoriaEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "categoria_id" })
  categoria?: CategoriaEntity;

  @Column({ type: "text" })
  nombre!: string;

  @Column({ type: "text", nullable: true })
  descripcion!: string | null;

  @Column({ name: "archivo_imagen_id", type: "uuid", nullable: true })
  archivo_imagen_id!: string | null;

  @ManyToOne(() => ArchivoEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "archivo_imagen_id" })
  archivo_imagen?: ArchivoEntity;

  @Column({ name: "es_fragil", type: "boolean", default: false })
  es_fragil!: boolean;

  @Column({ name: "precio_base_centavos", type: "bigint" })
  precio_base_centavos!: string;

  @Column({ name: "empaque_centavos", type: "bigint", default: "0" })
  empaque_centavos!: string;

  @Column({ name: "tipo_margen", type: "text", default: "FIJO" })
  tipo_margen!: "FIJO" | "PORCENTAJE";

  @Column({ name: "valor_margen", type: "numeric", precision: 12, scale: 4, default: "0" })
  valor_margen!: number;

  @Column({ name: "esta_activo", type: "boolean", default: true })
  esta_activo!: boolean;

  @Column({ name: "archivado_en", type: "timestamptz", nullable: true })
  archivado_en!: Date | null;

  @CreateDateColumn({ name: "creado_en", type: "timestamptz" })
  creado_en!: Date;

  @UpdateDateColumn({ name: "actualizado_en", type: "timestamptz" })
  actualizado_en!: Date;
}
