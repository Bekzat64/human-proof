import { formatPct } from "@/lib/format";
import type { DatasetRow, PublicData } from "@/lib/scenarios/types";

const churnPct = (rows: DatasetRow[]) =>
  (100 * rows.reduce((sum, r) => sum + r.cancellations, 0)) /
  rows.reduce((sum, r) => sum + r.subs_start, 0);

/**
 * The 24-row dataset exactly as the candidate will get it, plus a derived
 * churn column and monthly totals (dev aids — the candidate works those out).
 */
export function DatasetTable({ publicData }: { publicData: PublicData }) {
  const { columns, dataset, months } = publicData;

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm tabular-nums">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-3 py-2 font-medium ${column.kind === "count" || column.kind === "usd" ? "text-right" : ""}`}
              >
                <span className="block">{column.label}</span>
                <code className="font-mono text-xs font-normal">{column.key}</code>
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">
              <span className="block">Churn</span>
              <span className="text-xs font-normal">derived</span>
            </th>
          </tr>
        </thead>
        {months.map((month) => {
          const rows = dataset.filter((r) => r.month === month.key);
          return (
            <tbody key={month.key} className="border-t">
              {rows.map((row) => (
                <tr key={row.channel}>
                  {columns.map((column) => {
                    const value = row[column.key];
                    return (
                      <td
                        key={column.key}
                        className={`px-3 py-1.5 ${typeof value === "number" ? "text-right" : ""}`}
                      >
                        {typeof value === "number"
                          ? `${column.kind === "usd" ? "$" : ""}${value.toLocaleString("en-US")}`
                          : value}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right">{formatPct(churnPct([row]), 2)}%</td>
                </tr>
              ))}
              <tr className="bg-muted/30 font-medium">
                <td className="px-3 py-1.5" colSpan={columns.length}>
                  {month.label} — all channels
                </td>
                <td className="px-3 py-1.5 text-right">{formatPct(churnPct(rows), 2)}%</td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
