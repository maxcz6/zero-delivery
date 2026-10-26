import type { Exporter, TabularDataset } from "../domain/dataset";

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exportador CSV nativo con BOM UTF-8 (\uFEFF), separador coma e importes con 2 decimales.
 * Sección 13 y CA-14: sólo formatea el TabularDataset ya autorizado y filtrado por alcance.
 */
export class CsvExporter implements Exporter {
  public readonly format = "csv" as const;

  public exportToBuffer(dataset: TabularDataset): Buffer {
    const headerLine = dataset.columns.map((c) => escapeCsvCell(c.header)).join(",");
    const bodyLines = dataset.rows.map((row) =>
      dataset.columns
        .map((col) => {
          const val = row[col.key];
          if (col.type === "cents" && typeof val === "number") {
            return escapeCsvCell((val / 100).toFixed(2));
          }
          return escapeCsvCell(val);
        })
        .join(","),
    );

    const csvContent = "\uFEFF" + [headerLine, ...bodyLines].join("\r\n") + "\r\n";
    return Buffer.from(csvContent, "utf-8");
  }
}
