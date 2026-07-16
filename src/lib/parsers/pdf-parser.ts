import { getDocumentProxy } from "unpdf";

// Two text items belong to the same visual line when their vertical positions
// sit within this many PDF units of each other. Bank-statement body text is
// ~8-10 units tall; half a line height reliably groups a row without merging
// the row above or below it.
const LINE_TOLERANCE = 4;

type PositionedItem = {
  str: string;
  x: number;
  y: number;
};

/**
 * Reconstruct a page's text with its visual layout preserved.
 *
 * Joining every text item in raw reading order detaches values from their rows
 * on multi-column statements (e.g. BPI's "Extracto Integrado", where DATA MOV /
 * DATA VAL / DESCRIÇÃO / VALOR / SALDO are separate columns) — the date columns
 * end up in one block and the amounts in another, so the model has to re-guess
 * which date belongs to which row. By grouping items into lines by their y
 * coordinate and ordering each line left-to-right by x, each transaction row
 * stays intact: its date, description, amount, and running balance line up as
 * they do on the page.
 */
function layoutPageText(items: PositionedItem[]): string {
  const withText = items.filter((it) => it.str.trim().length > 0);
  if (withText.length === 0) return "";

  // pdf.js y grows upward, so a larger y is higher on the page. Sort descending
  // to read top-to-bottom.
  const sorted = [...withText].sort((a, b) => b.y - a.y);

  const lines: PositionedItem[][] = [];
  let current: PositionedItem[] = [];
  let lineY = sorted[0].y;

  for (const item of sorted) {
    if (Math.abs(item.y - lineY) <= LINE_TOLERANCE) {
      current.push(item);
    } else {
      lines.push(current);
      current = [item];
      lineY = item.y;
    }
  }
  if (current.length > 0) lines.push(current);

  return lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((it) => it.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((line) => line.length > 0)
    .join("\n");
}

export async function parsePdfToText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const items: PositionedItem[] = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } =>
        "str" in item && "transform" in item
      )
      .map((item) => ({
        str: item.str,
        // pdf.js text-item transform is [a, b, c, d, e, f]; e and f are the x
        // and y translation of the item's baseline.
        x: item.transform[4],
        y: item.transform[5],
      }));

    parts.push(layoutPageText(items));
  }

  return parts.join("\n\n");
}
