"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { importCsv, type ImportState } from "@/app/import/actions";
import { buildRejectsCsv } from "@/lib/csv/rejects";
import type { RejectedRow } from "@/lib/csv/types";
import { DownloadIcon, FileIcon, UploadIcon } from "./icons";

const initialState: ImportState = {};
const PREVIEW_LENGTH = 60;

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importCsv, initialState);
  const [chosen, setChosen] = useState<string | null>(null);
  const result = state.result;

  return (
    <>
      {/* React resets the form after the action runs, clearing the file input, so clear the label too. */}
      <form action={formAction} onSubmit={() => setChosen(null)} className="card stack">
        <label className={`dropzone${chosen ? " has-file" : ""}`}>
          <span className="dropzone-icon" aria-hidden="true">
            {chosen ? <FileIcon /> : <UploadIcon />}
          </span>
          <span className="dropzone-text">
            <strong>{chosen ?? "Choose a CSV file"}</strong>
            <span className="muted small">{chosen ? "Click to choose a different file" : "Max 1 MB, 5,000 rows"}</span>
          </span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            onChange={(e) => setChosen(e.currentTarget.files?.[0]?.name ?? null)}
          />
        </label>
        <div>
          <button type="submit" disabled={pending}>
            {pending ? "Importing…" : "Import tasks"}
          </button>
        </div>
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
            <li className="stat stat-ok">
              <strong>{result.imported}</strong> imported
            </li>
            <li className={`stat${result.rejected.length > 0 ? " stat-bad" : ""}`}>
              <strong>{result.rejected.length}</strong> rejected
            </li>
            <li className="stat">
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
    // Revoking straight away can cancel the download in Safari and some Firefox setups.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <>
      <div className="row section-head">
        <h3>Rejected rows</h3>
        <button type="button" className="secondary" onClick={download}>
          <DownloadIcon /> Download rejected rows (CSV)
        </button>
      </div>
      <div className="table-wrap">
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
            // Count code points, as validation does, so an emoji is never cut in half.
            const chars = Array.from(title);
            return (
              <tr key={row.rowNumber}>
                <td>{row.rowNumber}</td>
                <td title={title}>
                  {title === "" ? (
                    <span className="muted">(empty)</span>
                  ) : chars.length > PREVIEW_LENGTH ? (
                    `${chars.slice(0, PREVIEW_LENGTH).join("")}…`
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
      </div>
    </>
  );
}
