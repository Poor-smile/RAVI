"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeDocument } from "./document-analysis";
import { DocumentTextSnapshot, type DocumentChange } from "../workspace/document-text";

const empty = analyzeDocument("");
const WORKER_THRESHOLD = 64 * 1024;
type Patch = { previousLength: number; changes: readonly DocumentChange[] };

export function useDocumentAnalysis(snapshot: DocumentTextSnapshot) {
  const content = snapshot.text;
  const local = useMemo(() => content.length < WORKER_THRESHOLD ? analyzeDocument(content) : null, [content]);
  const [result, setResult] = useState(empty);
  const workerRef = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const pending = useRef<{ revision: number; patches: Patch[] | null }>({ revision: -1, patches: null });
  const initialized = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    workerRef.current?.terminate();
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
  }, []);
  useEffect(() => {
    const id = ++sequence.current;
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    if (local) {
      workerRef.current?.terminate(); workerRef.current = null;
      initialized.current = false; pending.current = { revision: snapshot.revision, patches: null };
      return;
    }
    const previous = pending.current;
    const contiguous = snapshot.changes && previous.revision + 1 === snapshot.revision && snapshot.previousLength !== undefined;
    pending.current = { revision: snapshot.revision, patches: contiguous && previous.patches && previous.patches.length < 256
      ? [...previous.patches, { previousLength: snapshot.previousLength!, changes: snapshot.changes! }] : null };
    const timer = setTimeout(() => {
      try {
        const worker = workerRef.current ?? new Worker(new URL("./document-analysis.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;
        worker.onmessage = event => {
          if (event.data.id !== sequence.current) return;
          if (event.data.resync) {
            worker.postMessage({ id, content, patches: null });
            return;
          }
          setResult(event.data.result);
          releaseTimer.current = setTimeout(() => {
            worker.terminate();
            if (workerRef.current === worker) { workerRef.current = null; initialized.current = false; }
          }, 30_000);
        };
        worker.onerror = () => {
          worker.terminate(); workerRef.current = null; initialized.current = false;
          if (id === sequence.current) setResult(analyzeDocument(content));
        };
        const patches = initialized.current ? pending.current.patches : null;
        worker.postMessage(patches ? { id, patches } : { id, content });
        initialized.current = true;
        pending.current.patches = [];
      } catch {
        initialized.current = false;
        if (id === sequence.current) setResult(analyzeDocument(content));
      }
    }, snapshot.changes ? 500 : 300);
    return () => clearTimeout(timer);
  }, [snapshot, content, local]);
  return local ?? result;
}
