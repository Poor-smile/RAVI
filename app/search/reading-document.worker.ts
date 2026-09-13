import { createReadingSearchService } from "./reading-search-service";

const service = createReadingSearchService(response => self.postMessage(response));
self.onmessage = event => service.request(event.data);
