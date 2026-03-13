import { EventEmitter } from "events";

const emitter = new EventEmitter();

export class Poller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cache: Record<string, unknown>[] = [];
  private handler: ((payload: unknown) => void) | null = null;

  start(url: string) {
    // Safe: interval reference stored for later cleanup
    const intervalId = setInterval(async () => {
      const response = await fetch(url);
      const data = await response.json();
      this.cache.push(data);
    }, 1000);
    this.intervalId = intervalId;

    this.handler = (payload: unknown) => {
      this.cache.push(payload as Record<string, unknown>);
    };
    emitter.on("data", this.handler);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.handler) {
      emitter.off("data", this.handler);
      this.handler = null;
    }
    this.cache = [];
  }
}
