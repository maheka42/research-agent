/**
 * Client for the backend's single streaming endpoint.
 *
 * `POST /api/chat` answers with Server-Sent Events rather than one JSON body, so
 * a research run can report each agent as it finishes instead of going quiet for
 * a minute. `EventSource` is not usable here because it cannot issue a POST with
 * a multipart body, so the frames are parsed off the fetch stream by hand.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface TurnRequest {
  message: string;
  history: { role: string; content: string }[];
  currentReport: string;
  files?: File[];
}

export interface StreamEvent {
  type: string;
  data: Record<string, unknown>;
}

/** Parse one `event:`/`data:` frame. Returns null for comments and keep-alives. */
function parseFrame(frame: string): StreamEvent | null {
  let type = "";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  if (!type || dataLines.length === 0) return null;
  try {
    return { type, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

/**
 * Send one chat turn and invoke `onEvent` for each frame the backend emits.
 * Resolves when the stream ends; throws if the request itself fails.
 */
export async function streamTurn(
  request: TurnRequest,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const form = new FormData();
  form.append("message", request.message);
  form.append("history", JSON.stringify(request.history));
  form.append("current_report", request.currentReport);
  for (const file of request.files ?? []) form.append("files", file);

  const response = await fetch(`${API_BASE}/api/chat`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`Server error: ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error("The server sent no response stream");

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    // Frames are separated by a blank line; keep the trailing partial frame in
    // the buffer until the rest of it arrives.
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseFrame(frame);
      if (event) onEvent(event);
    }
  }

  const trailing = parseFrame(buffer);
  if (trailing) onEvent(trailing);
}
