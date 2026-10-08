import type { Metadata } from "next";
import { ImportForm } from "@/components/ImportForm";

export const metadata: Metadata = { title: "Import tasks" };

export default function ImportPage() {
  return (
    <>
      <div className="page-head">
        <h1>Import tasks from CSV</h1>
      </div>
      <p className="muted lede">
        The first row must be a header with the columns <code>title</code>, <code>due_date</code> and{" "}
        <code>priority</code>, and optionally <code>notes</code>, in any order. Dates use the{" "}
        <code>YYYY-MM-DD</code> format and priority is a whole number from 1 to 5. Valid rows are saved together; rows
        with problems are listed below with the reasons.
      </p>
      <ImportForm />
    </>
  );
}
