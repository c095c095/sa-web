import type { ReactNode } from "react";

export function RecordsTable({
  label,
  columns,
  rows,
  empty,
}: {
  label: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
  empty: string;
}) {
  if (!rows.length) return <p className="panel-surface p-5 text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="table" role="table">
        <caption className="sr-only">{label}</caption>
        <thead className="sr-only bg-base-200 text-base-content sm:not-sr-only" role="rowgroup">
          <tr role="row">{columns.map((column) => <th key={column} scope="col" role="columnheader">{column}</th>)}</tr>
        </thead>
        <tbody className="block divide-y divide-base-300 sm:table-row-group" role="rowgroup">
          {rows.map(({ key, cells }) => (
            <tr key={key} className="grid py-2 hover:bg-base-200/50 sm:table-row sm:py-0" role="row">
              <th scope="row" role="rowheader" className="flex flex-wrap items-baseline gap-x-2 font-medium sm:table-cell">
                <span className="text-sm text-muted sm:hidden" aria-hidden="true">{columns[0]}</span>
                {cells[0]}
              </th>
              {cells.slice(1).map((cell, index) => (
                <td key={columns[index + 1]} role="cell" className="flex flex-col items-start gap-1 py-2 sm:table-cell">
                  <span className="text-sm text-muted sm:hidden" aria-hidden="true">{columns[index + 1]}</span>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
