"use client";

import { useEffect } from "react";

const KEYBOARD_OFFSET_PROPERTY = "--raavi-keyboard-offset";
const VISUAL_HEIGHT_PROPERTY = "--raavi-visual-height";

/**
 * Keeps fixed mobile controls above the software keyboard without coupling the
 * document model to viewport quirks. Browsers without VisualViewport retain
 * the CSS fallbacks and the app remains fully usable.
 */
export function useVisualViewportInsets() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;

    if (!viewport) {
      root.style.setProperty(KEYBOARD_OFFSET_PROPERTY, "0px");
      root.style.setProperty(VISUAL_HEIGHT_PROPERTY, "100dvh");
      return () => {
        root.style.removeProperty(KEYBOARD_OFFSET_PROPERTY);
        root.style.removeProperty(VISUAL_HEIGHT_PROPERTY);
      };
    }

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const obscuredBottom = Math.max(
          0,
          window.innerHeight - viewport.height - viewport.offsetTop,
        );
        root.style.setProperty(
          KEYBOARD_OFFSET_PROPERTY,
          `${Math.round(obscuredBottom)}px`,
        );
        root.style.setProperty(
          VISUAL_HEIGHT_PROPERTY,
          `${Math.round(viewport.height)}px`,
        );
      });
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty(KEYBOARD_OFFSET_PROPERTY);
      root.style.removeProperty(VISUAL_HEIGHT_PROPERTY);
    };
  }, []);
}
