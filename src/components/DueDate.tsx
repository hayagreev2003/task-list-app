"use client";

import { useSyncExternalStore } from "react";
import { CalendarIcon } from "./icons";

const subscribe = () => () => {};
/** Today as YYYY-MM-DD in the viewer's time zone. */
const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// The server doesn't know the viewer's time zone, so relative labels appear only after hydration.
const getServerToday = () => null;

const formatter = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DAY_MS = 86_400_000;

function relative(due: string, today: string) {
  const days = Math.round((Date.parse(due) - Date.parse(today)) / DAY_MS);
  if (days < 0) return { label: days === -1 ? "1 day overdue" : `${-days} days overdue`, tone: "overdue" };
  if (days === 0) return { label: "Due today", tone: "soon" };
  if (days === 1) return { label: "Due tomorrow", tone: "soon" };
  if (days < 7) return { label: `In ${days} days`, tone: "" };
  return null;
}

export function DueDate({ date, done }: { date: string; done: boolean }) {
  const today = useSyncExternalStore(subscribe, getToday, getServerToday);
  const parsed = Date.parse(date);
  const rel = today && !done ? relative(date, today) : null;

  return (
    <span className={`due${rel?.tone ? ` due-${rel.tone}` : ""}`}>
      <CalendarIcon />
      <time dateTime={date}>{Number.isNaN(parsed) ? date : formatter.format(parsed)}</time>
      {rel ? <span className="due-rel">{rel.label}</span> : null}
    </span>
  );
}
