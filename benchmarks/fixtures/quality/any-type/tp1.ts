interface TransformResult {
  value: string;
  timestamp: number;
}

// Bad: using 'any' loses type safety
export function processData(data: any): TransformResult {
  return {
    value: data.toString(),
    timestamp: Date.now(),
  };
}

export function mergeObjects(target: any, source: any): any {
  return { ...target, ...source };
}

export function handleEvent(event: any) {
  const payload: any = event.data;
  console.log(payload.message);
}
