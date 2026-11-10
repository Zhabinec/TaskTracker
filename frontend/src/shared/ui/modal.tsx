"use client";

import { useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./modal.module.css";

export function Modal({ title, children, onRequestClose, closeDisabled = false }: {
  title: string; children: ReactNode; onRequestClose: () => void; closeDisabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.documentElement.style.overflow;
    element.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => { element.close(); document.documentElement.style.overflow = previousOverflow; };
  }, []);
  return createPortal(<dialog ref={dialog} className={styles.modal} aria-labelledby={titleId} onCancel={event => {
    event.preventDefault(); if (!closeDisabled) onRequestClose();
  }}>
    <header className={styles.header}><h2 id={titleId}>{title}</h2>
      <button type="button" className="secondary" aria-label={`Close ${title.toLowerCase()}`} disabled={closeDisabled} onClick={onRequestClose}>×</button>
    </header>
    {children}
  </dialog>, document.body);
}
