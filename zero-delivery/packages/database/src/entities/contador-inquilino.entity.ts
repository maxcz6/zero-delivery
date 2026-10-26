import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { InquilinoEntity } from "./inquilino.entity";

@Entity({ name: "contadores_inquilino" })
export class ContadorInquilinoEntity {
  @PrimaryColumn({ name: "inquilino_id", type: "uuid" })
  inquilino_id!: string;

  @ManyToOne(() => InquilinoEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "inquilino_id" })
  inquilino?: InquilinoEntity;

  @PrimaryColumn({ type: "text" })
  nombre!: string;

  @Column({ type: "bigint", default: "0" })
  valor!: string;
}
