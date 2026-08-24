"use client";

import { useState } from "react";

/**
 * Owns the transient disclosure state of App Chrome. Keeping these controls
 * together prevents the document workspace from becoming the source of truth
 * for titlebar and command-bar popovers.
 */
export function useAppChromeState() {
  const mobileHeaderMenu = useState(false);
  const documentMenu = useState(false);
  const mobileEditorTools = useState(false);
  const editorToolMenu = useState(false);

  return [
    mobileHeaderMenu,
    documentMenu,
    mobileEditorTools,
    editorToolMenu,
  ] as const;
}
