import type { MermaidRenderJob, MermaidRendererOutput, MermaidRendererTransport } from "./scheduler";

export type ElectronMermaidBridge = {
  render: (job: MermaidRenderJob) => Promise<MermaidRendererOutput>;
  restart: (reason: "timeout" | "crash" | "superseded") => Promise<void>;
};

declare global {
  interface Window {
    raaviMermaid?: ElectronMermaidBridge;
  }
}

export class ElectronMermaidRendererTransport implements MermaidRendererTransport {
  constructor(private readonly bridge: ElectronMermaidBridge) {}

  render(job: MermaidRenderJob) {
    return this.bridge.render(job);
  }

  restart(reason: "timeout" | "crash" | "superseded") {
    return this.bridge.restart(reason);
  }
}
