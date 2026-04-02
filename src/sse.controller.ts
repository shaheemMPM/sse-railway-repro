import { Controller, MessageEvent, Query, Sse } from "@nestjs/common";
import { Observable, Subject } from "rxjs";

/**
 * Generates a fake HTML string of approximately the given size in KB.
 * Mimics the structure of a real invoice template with line items.
 */
function generateFakeHtml(sizeKb: number): string {
  const targetBytes = sizeKb * 1024;

  let html = "<html><head><style>.item { padding: 10px; }</style></head><body>";
  html += "<h1>Invoice #TEST-001</h1>";
  html += "<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>HSN</th><th>GST</th><th>Total</th></tr></thead><tbody>";

  let i = 0;
  while (html.length < targetBytes) {
    i++;
    html += `<tr class="item"><td>Product Item ${i} - Some long product name with details and specifications</td><td>${i}</td><td>Rs. ${(i * 100).toFixed(2)}</td><td>85176290</td><td>18%</td><td>Rs. ${(i * 118).toFixed(2)}</td></tr>`;
  }

  html += "</tbody></table></body></html>";
  return html;
}

@Controller()
export class SseController {
  /**
   * SSE endpoint that mimics the real print/preview/stream behavior.
   *
   * - Sends an "init" event
   * - Sends a "preview" event with a large HTML payload
   * - Sends a "complete" event
   * - Immediately calls subject.complete() (triggers response.end())
   *
   * Query params:
   *   sizeKb  - size of the fake HTML payload in KB (default: 250)
   *   delay   - ms to wait before subject.complete() (default: 0)
   */
  @Sse("stream")
  streamTest(
    @Query("sizeKb") sizeKb?: string,
    @Query("delay") delay?: string,
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    const size = parseInt(sizeKb || "250", 10);
    const delayMs = parseInt(delay || "0", 10);

    this.processStream(subject, size, delayMs);

    return subject.asObservable();
  }

  private async processStream(
    subject: Subject<MessageEvent>,
    sizeKb: number,
    delayMs: number,
  ) {
    // Yield to event loop so NestJS can subscribe to the observable
    // before we start emitting. In the real app, the first `await`
    // (Shopify API call / DB query) serves this purpose naturally.
    await new Promise((resolve) => setImmediate(resolve));

    // 1. Send init event
    subject.next({
      data: JSON.stringify({ total: 1 }),
      type: "init",
    } as MessageEvent);

    // 2. Generate and send large preview
    const html = generateFakeHtml(sizeKb);

    subject.next({
      data: JSON.stringify({
        html,
        orderId: "gid://shopify/Order/123456789",
        templateType: "invoice",
        invoiceType: "original",
      }),
      type: "preview",
    } as MessageEvent);

    // 3. Send complete event
    subject.next({
      data: JSON.stringify({ status: "complete" }),
      type: "complete",
    } as MessageEvent);

    // 4. Close the observable (with optional delay)
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    subject.complete();
  }

  /**
   * SSE endpoint for custom message sequences.
   * Sends messages of specified sizes with optional delays between them.
   * Does NOT close the stream — keeps it open to test if messages arrive
   * independent of connection close behavior.
   *
   * Query params:
   *   sizes    - comma-separated message sizes in KB (e.g. "250,1,1")
   *   delays   - comma-separated delays in ms after each message (e.g. "0,0,0")
   *   close    - whether to close the stream after all messages ("true"/"false", default "false")
   */
  @Sse("stream-multi")
  streamMulti(
    @Query("sizes") sizes?: string,
    @Query("delays") delays?: string,
    @Query("close") close?: string,
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    const sizeList = (sizes || "250,1").split(",").map((s) => parseInt(s, 10));
    const delayList = (delays || "").split(",").map((s) => parseInt(s, 10) || 0);
    const shouldClose = close === "true";

    this.processMultiStream(subject, sizeList, delayList, shouldClose);

    return subject.asObservable();
  }

  private async processMultiStream(
    subject: Subject<MessageEvent>,
    sizes: number[],
    delays: number[],
    shouldClose: boolean,
  ) {
    await new Promise((resolve) => setImmediate(resolve));

    // Send each message in sequence
    for (let i = 0; i < sizes.length; i++) {
      const sizeKb = sizes[i];
      const payload =
        sizeKb <= 1
          ? JSON.stringify({ index: i, msg: "small", size: `${sizeKb}KB` })
          : JSON.stringify({ index: i, html: generateFakeHtml(sizeKb) });

      subject.next({
        data: payload,
        type: "msg",
      } as MessageEvent);

      const delayMs = delays[i] || 0;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // Send a sentinel event so the client knows all messages were emitted
    subject.next({
      data: JSON.stringify({ status: "done", totalSent: sizes.length }),
      type: "done",
    } as MessageEvent);

    if (shouldClose) {
      subject.complete();
    }
    // If !shouldClose, stream stays open — client can observe whether
    // all messages arrived without the close/FIN variable.
  }
}
