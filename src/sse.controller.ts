import { Controller, Get, MessageEvent, Query, Sse } from "@nestjs/common";
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
}
