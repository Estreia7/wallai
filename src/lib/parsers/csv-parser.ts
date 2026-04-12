import Papa from "papaparse";

export function parseCsvToText(buffer: Buffer): string {
  const text = buffer.toString("utf-8");

  const commaResult = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const semicolonResult = Papa.parse<string[]>(text, { skipEmptyLines: true, delimiter: ";" });

  const commaAvg = avgColumns(commaResult.data);
  const semicolonAvg = avgColumns(semicolonResult.data);

  const rows = semicolonAvg > commaAvg ? semicolonResult.data : commaResult.data;

  return rows.map((row) => row.join("\t")).join("\n");
}

function avgColumns(rows: string[][]): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + row.length, 0);
  return total / rows.length;
}
