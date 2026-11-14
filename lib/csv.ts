import type { DatasetColumn, DatasetRow } from "./scenarios/types";

const escape = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** The dataset as CSV: header row of column keys, then one line per row. */
export function datasetToCsv(columns: readonly DatasetColumn[], rows: readonly DatasetRow[]): string {
  const header = columns.map((c) => c.key).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\r\n") + "\r\n";
}
