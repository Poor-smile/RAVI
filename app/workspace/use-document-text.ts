"use client";
import { useCallback, useState, type SetStateAction } from "react";
import { DocumentTextSnapshot, type DocumentEdit } from "./document-text";

export function useDocumentText(initial: string) {
  const [snapshot, setSnapshot] = useState(() => new DocumentTextSnapshot(initial));
  const setText = useCallback((next: SetStateAction<string>) => {
    setSnapshot(current => {
      const value = typeof next === "function" ? next(current.text) : next;
      return value === current.text ? current : new DocumentTextSnapshot(value, current.revision + 1);
    });
  }, []);
  const applyEdit = useCallback((edit: DocumentEdit) => setSnapshot(current => current.edit(edit)), []);
  return { snapshot, setText, applyEdit };
}
