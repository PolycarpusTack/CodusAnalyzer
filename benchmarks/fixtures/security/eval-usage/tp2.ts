export interface ScriptRunner {
  execute(code: string): unknown;
}

export class DynamicExecutor implements ScriptRunner {
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown> = {}) {
    this.context = context;
  }

  execute(code: string): unknown {
    // Dangerous: eval wrapped inside a function
    return eval(code);
  }

  runWithTimeout(code: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
      try {
        const result = eval(code);
        clearTimeout(timer);
        resolve(result);
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    });
  }
}
