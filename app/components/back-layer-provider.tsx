"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BackLayerController } from "../back-layer-controller";

const BackLayerContext = createContext<BackLayerController | null>(null);

function createBrowserController() {
  return new BackLayerController(
    {
      get state() {
        return window.history.state;
      },
      pushState(data, unused) {
        window.history.pushState(data, unused);
      },
      replaceState(data, unused) {
        window.history.replaceState(data, unused);
      },
      back() {
        window.history.back();
      },
    },
    {
      addEventListener(type, listener) {
        window.addEventListener(type, listener);
      },
      removeEventListener(type, listener) {
        window.removeEventListener(type, listener);
      },
    },
    { microtask: (callback) => queueMicrotask(callback) },
  );
}

export function BackLayerProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(createBrowserController);

  useLayoutEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  return (
    <BackLayerContext.Provider value={controller}>
      {children}
    </BackLayerContext.Provider>
  );
}

export function useBackLayer(
  id: string,
  open: boolean,
  onDismiss: () => void,
  enabled = true,
) {
  const controller = useContext(BackLayerContext);
  const dismissRef = useRef(onDismiss);

  useLayoutEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!controller || !enabled || !open) return;
    return controller.register(id, () => dismissRef.current());
  }, [controller, enabled, id, open]);
}
