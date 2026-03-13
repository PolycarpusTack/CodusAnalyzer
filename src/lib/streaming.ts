/**
 * Creates a ReadableStream that emits Server-Sent Events (SSE) from a review
 * result object. The stream sends progress status events followed by the final
 * result event.
 */
export function createReviewStream(data: object): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      function send(event: string, payload: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
      }

      try {
        send('result', JSON.stringify(data));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send('error', JSON.stringify({ error: message }));
        controller.close();
      }
    },
  });
}

/**
 * Creates a ReadableStream with fine-grained control over when events are
 * emitted. Returns an object with helper methods so the caller can push
 * status updates, the final result, or errors at arbitrary points in time.
 */
export function createStreamController() {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
    },
  });

  function send(event: string, payload: string) {
    controllerRef?.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
  }

  return {
    stream,

    sendStatus(message: string) {
      send('status', JSON.stringify({ message }));
    },

    sendResult(data: object) {
      send('result', JSON.stringify(data));
    },

    sendError(error: string) {
      send('error', JSON.stringify({ error }));
    },

    close() {
      controllerRef?.close();
    },
  };
}

/**
 * Client-side parser for SSE text. Splits the raw text into an array of
 * `{ event, data }` objects.
 */
export function parseSSE(text: string): Array<{ event: string; data: string }> {
  const results: Array<{ event: string; data: string }> = [];
  const blocks = text.split(/\n\n/).filter(Boolean);

  for (const block of blocks) {
    let event = 'message';
    let data = '';

    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        event = line.slice('event: '.length);
      } else if (line.startsWith('data: ')) {
        data = line.slice('data: '.length);
      }
    }

    if (data) {
      results.push({ event, data });
    }
  }

  return results;
}
