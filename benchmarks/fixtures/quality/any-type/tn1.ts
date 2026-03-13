interface TransformResult {
  value: string;
  timestamp: number;
}

// Good: using 'unknown' forces type checking before use
export function processData(data: unknown): TransformResult {
  if (typeof data !== "object" || data === null) {
    throw new TypeError("Expected an object");
  }

  return {
    value: String(data),
    timestamp: Date.now(),
  };
}

export function mergeObjects<T extends object, U extends object>(
  target: T,
  source: U
): T & U {
  return { ...target, ...source };
}

export function handleEvent(event: MessageEvent<{ message: string }>) {
  const payload = event.data;
  console.log(payload.message);
}
