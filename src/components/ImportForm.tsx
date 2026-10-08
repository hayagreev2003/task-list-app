"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importCsv, type ImportState } from "@/app/import/actions";
import { buildRejectsCsv } from "@/lib/csv/rejects";
import type { RejectedRow } from "@/lib/csv/types";

const initialState: ImportState = {};
const PREVIEW_LENGTH = 60;

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importCsv, initialState);
  const result = state.result;

  return (
    <>
      <form action={formAction} className="card stack">
        <label>
          CSV file (max 1 MB, 5,000 rows)
          <input type="file" name="file" accept=".csv,text/csv" required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </button>
      </form>

      {pending ? (
        <p role="status" className="muted">
          Importing… this can take a few seconds for large files.
        </p>
      ) : null}

      {!pending && result && !result.ok ? (
        <p role="alert" className="banner error">
          {state.fileName ? <strong>{state.fileName}: </strong> : null}
          {result.error}
        </p>
      ) : null}

      {!pending && result?.ok ? (
        <section aria-labelledby="import-summary">
          <h2 id="import-summary">Import results{state.fileName ? ` for ${state.fileName}` : ""}</h2>
          <ul className="summary">
            <li>
              <strong>{result.imported}</strong> imported
            </li>
            <li>
              <strong>{result.rejected.length}</strong> rejected
            </li>
            <li>
              <strong>{result.blankSkipped}</strong> blank row{result.blankSkipped === 1 ? "" : "s"} skipped
            </li>
          </ul>
          {result.imported > 0 ? (
            <p>
              <Link href="/tasks">View your tasks</Link>
            </p>
          ) : null}
          {result.rejected.length > 0 ? (
            <RejectedTable headers={result.headers} rejected={result.rejected} fileName={state.fileName} />
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function RejectedTable({
  headers,
  rejected,
  fileName,
}: {
  headers: string[];
  rejected: RejectedRow[];
  fileName?: string;
}) {
  const titleIndex = headers.findIndex((h) => h.toLowerCase() === "title");

  function download() {
    const csv = buildRejectsCsv(headers, rejected);
    // Prepend a BOM so Excel opens the UTF-8 file with the right encoding.
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(fileName ?? "import").replace(/\.csv$/i, "")}-rejected.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="row">
        <h3>Rejected rows</h3>
        <button type="button" className="secondary" onClick={download}>
          Download rejected rows (CSV)
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">Row</th>
            <th scope="col">Title</th>
            <th scope="col">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rejected.map((row) => {
            const title = titleIndex === -1 ? "" : (row.cells[titleIndex] ?? "").trim();
            return (
              <tr key={row.rowNumber}>
                <td>{row.rowNumber}</td>
                <td title={title}>
                  {title === "" ? (
                    <span className="muted">(empty)</span>
                  ) : title.length > PREVIEW_LENGTH ? (
                    `${title.slice(0, PREVIEW_LENGTH)}…`
                  ) : (
                    title
                  )}
                </td>
                <td>
                  <ul className="reasons">
                    {row.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
