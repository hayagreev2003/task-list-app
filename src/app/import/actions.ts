"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { MAX_FILE_BYTES, runImport, type ImportResult } from "@/lib/csv/import";

export type ImportState = { result?: ImportResult; fileName?: string };

const CSV_TYPES = new Set(["", "text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"]);

const fail = (error: string, fileName?: string): ImportState => ({ result: { ok: false, error }, fileName });

/** Validates the upload, then imports it as the signed-in user. Never throws to the client. */
export async function importCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase } = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.name === "") return fail("Choose a CSV file to upload.");
  const fileName = file.name;

  if (file.size === 0) return fail("The file is empty.", fileName);
  if (file.size > MAX_FILE_BYTES) return fail("The file is larger than 1 MB. Split it into smaller files.", fileName);
  if (!fileName.toLowerCase().endsWith(".csv") || !CSV_TYPES.has(file.type)) {
    return fail("Upload a .csv file.", fileName);
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return fail("The file isn't valid UTF-8 text. Save it as “CSV UTF-8” and try again.", fileName);
  }
  if (text.includes("\u0000")) return fail("This doesn't look like a CSV text file.", fileName);

  try {
    const result = await runImport(supabase, text);
    if (result.ok && result.imported > 0) revalidatePath("/tasks");
    return { result, fileName };
  } catch (error) {
    console.error("import failed", error);
    return fail("The import failed and no rows were saved. Please try again.", fileName);
  }
}
