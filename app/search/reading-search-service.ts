import { createReadingDocumentIndexer, createReadingSearchAccumulator, searchReadingDocument, type IndexedBlock } from "./reading-document-index";
import { yieldSearchTask } from "./yield-task";

type Request = { id: number; content?: string; query: string; page: number };
type Response = ReturnType<typeof searchReadingDocument> & { id: number; error?: boolean };

export function createReadingSearchService(reply: (response: Response) => void) {
  const indexer = createReadingDocumentIndexer();
  let desiredContent: string | null = null;
  let indexedContent: string | null = null;
  let index: IndexedBlock[] = [];
  let generation = 0;
  let latest: Request | null = null;
  let running = false;
  const yieldTask = yieldSearchTask;

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (latest) {
        const request = latest;
        const version = generation;
        try {
          if (desiredContent === null) throw new Error("Search document missing");
          if (indexedContent !== desiredContent) {
            const content = desiredContent;
            const built = await indexer.build(content, () => version !== generation, yieldTask);
            if (!built) continue;
            index = built.blocks;
            indexedContent = content;
          }
          const scan = createReadingSearchAccumulator(request.query, request.page);
          for (let offset = 0; offset < index.length; offset++) {
            scan.add(index[offset]);
            if (offset % 64 === 0) {
              await yieldTask();
              if (latest !== request || generation !== version) break;
            }
          }
          if (latest !== request || generation !== version) continue;
          reply({ id: request.id, ...scan.result() });
          latest = null;
        } catch {
          if (latest !== request) continue;
          reply({ id: request.id, error: true, results: [], total: 0 });
          latest = null;
        }
      }
    } finally { running = false; }
  }

  return {
    request(request: Request) {
      if (request.content !== undefined && request.content !== desiredContent) {
        desiredContent = request.content;
        generation++;
      }
      latest = request;
      void drain();
    },
  };
}
