import { EventEmitter } from "events";

const emitter = new EventEmitter();
const cache: Record<string, unknown>[] = [];

export function startPolling(url: string) {
  // Potential leak: interval reference is never stored or cleared
  setInterval(async () => {
    const response = await fetch(url);
    const data = await response.json();
    cache.push(data);
  }, 1000);

  // Potential leak: listener added without removal
  emitter.on("data", (payload) => {
    cache.push(payload);
  });
}

export function initBackgroundTask() {
  setInterval(() => {
    processQueue();
  }, 5000);
}

function processQueue() {
  // processing logic
}
