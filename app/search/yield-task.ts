// Message tasks yield to incoming worker requests without the nested timer
// clamp that can add seconds across hundreds of document chunks.
export function yieldSearchTask() {
  return new Promise<void>(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close(); channel.port2.close(); resolve();
    };
    channel.port2.postMessage(null);
  });
}
