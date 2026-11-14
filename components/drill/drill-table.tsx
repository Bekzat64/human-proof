import type { DrillTable as Table } from "@/lib/drill/types";

const cell = (value: string | number) => (typeof value === "number" ? value.toLocaleString("en-US") : value);

/** The small data table of a drill item. */
export function DrillTable({ table }: { table: Table }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
            {table.columns.map((column, i) => (
              <th key={column} scope="col" className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={String(row[0])} className="border-b last:border-b-0">
              {row.map((value, i) => (
                <td key={i} className={`px-3 py-2 tabular-nums ${i > 0 ? "text-right" : "font-medium"}`}>
                  {cell(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
