import * as XLSX from "xlsx";

export function parseExcelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return "";
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
  return rows.map((row) => (Array.isArray(row) ? row.join("\t") : "")).join("\n");
}
