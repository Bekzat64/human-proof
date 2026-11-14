"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EventLogger } from "@/lib/capture/event-logger";
import { datasetToCsv } from "@/lib/csv";
import { formatCount } from "@/lib/format";
import type { Channel, DatasetColumn, DatasetRow, PublicData } from "@/lib/scenarios/types";
import { cn } from "@/lib/utils";

type Sort = { key: keyof DatasetRow; direction: "asc" | "desc" };
type ChannelFilter = Channel | "all";

const isNumeric = (column: DatasetColumn) => column.kind === "count" || column.kind === "usd";

function display(column: DatasetColumn, row: DatasetRow): string {
  const value = row[column.key];
  if (typeof value !== "number") return value;
  return column.kind === "usd" ? `$${formatCount(value)}` : formatCount(value);
}

/**
 * The scenario's dataset: sortable, filterable by channel, downloadable as
 * CSV. Every way of looking at the data is logged as a `data_view` event.
 */
export function DataTable({ publicData, logger }: { publicData: PublicData; logger: EventLogger }) {
  const { columns, dataset, channels } = publicData;
  const [sort, setSort] = useState<Sort | null>(null);
  const [channel, setChannel] = useState<ChannelFilter>("all");

  // Log a "view" each time the table comes on screen (page load on desktop,
  // every switch to the Data tab on mobile).
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = tableRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) logger.log({ type: "data_view", payload: { action: "view" } });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [logger]);

  const rows = useMemo(() => {
    const visible = channel === "all" ? dataset : dataset.filter((row) => row.channel === channel);
    if (!sort) return visible;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...visible].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      return sign * (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)));
    });
  }, [dataset, channel, sort]);

  function sortBy(key: keyof DatasetRow) {
    const direction = sort?.key === key && sort.direction === "asc" ? "desc" : "asc";
    setSort({ key, direction });
    logger.log({ type: "data_view", payload: { action: "sort", column: key, direction } });
  }

  function filterBy(next: ChannelFilter) {
    setChannel(next);
    logger.log({ type: "data_view", payload: { action: "filter", channel: next } });
  }

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([datasetToCsv(columns, dataset)], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "subscribers-by-channel.csv";
    link.click();
    URL.revokeObjectURL(url);
    logger.log({ type: "data_view", payload: { action: "download" } });
  }

  return (
    <section aria-labelledby="data-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="data-heading" className="text-base font-semibold">
          Subscribers by channel, Apr–Sep 2026
        </h2>
        <Button variant="outline" onClick={downloadCsv}>
          <Download aria-hidden /> Download CSV
        </Button>
      </div>

      <div role="group" aria-label="Filter by channel" className="flex flex-wrap gap-1.5">
        {(["all", ...channels] as ChannelFilter[]).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={channel === option ? "default" : "outline"}
            aria-pressed={channel === option}
            onClick={() => filterBy(option)}
          >
            {option === "all" ? "All channels" : option}
          </Button>
        ))}
      </div>

      <div ref={tableRef} className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={!active ? "none" : sort.direction === "asc" ? "ascending" : "descending"}
                    className="p-0 font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(column.key)}
                      className={cn(
                        "flex w-full items-center gap-1 px-2.5 py-2 whitespace-nowrap hover:text-foreground",
                        isNumeric(column) && "justify-end",
                        active && "text-foreground",
                      )}
                    >
                      {column.label}
                      <Icon aria-hidden className={cn("size-3.5", !active && "opacity-40")} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.month}-${row.channel}`} className="border-t">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-2.5 py-1.5 whitespace-nowrap", isNumeric(column) && "text-right")}
                  >
                    {display(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.length} of {dataset.length} rows. Click a column heading to sort.
      </p>
    </section>
  );
}
