"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";
import { ChevronDownIcon, ListIcon, LogOutIcon, UploadIcon } from "./icons";

/** "ada.lovelace@x.org" → "AL", "ada@x.org" → "AD". */
function initials(email: string) {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._\-+]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return (letters || "?").toUpperCase();
}

export function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div
      ref={rootRef}
      className="profile"
      // Close when focus leaves the menu (e.g. tabbing past the last item).
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="profile-button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${email}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(email)}
        </span>
        <ChevronDownIcon className="chevron" />
      </button>

      <div id={menuId} className="profile-menu" hidden={!open}>
        <div className="profile-head">
          <span className="avatar avatar-lg" aria-hidden="true">
            {initials(email)}
          </span>
          <div className="profile-id">
            <span className="muted small">Signed in as</span>
            <strong className="truncate" title={email}>
              {email}
            </strong>
          </div>
        </div>
        <ul className="menu-list">
          <li>
            <Link href="/tasks" className="menu-item" onClick={close}>
              <ListIcon /> Your tasks
            </Link>
          </li>
          <li>
            <Link href="/import" className="menu-item" onClick={close}>
              <UploadIcon /> Import CSV
            </Link>
          </li>
        </ul>
        <form action={signOut} className="menu-footer">
          <button type="submit" className="menu-item menu-item-danger">
            <LogOutIcon /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
