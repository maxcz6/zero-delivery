export type TabularColumn = {
  key: string;
  header: string;
  type: "string" | "number" | "cents" | "datetime";
};

export type TabularDataset = {
  columns: TabularColumn[];
  rows: Record<string, string | number | null>[];
  meta: {
    reportName: string;
    generatedAtIso: string;
    tenantId: string;
  };
};

export interface Exporter {
  readonly format: "csv" | "xlsx" | "pdf";
  exportToBuffer(dataset: TabularDataset): Buffer;
}
