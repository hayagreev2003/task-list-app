"use client";

import { useEffect } from "react";

export default function TasksError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="empty" role="alert">
      <h2>We couldn&apos;t load your tasks</h2>
      <p className="muted">This is usually temporary. Check your connection and try again.</p>
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
    </div>
  );
}
