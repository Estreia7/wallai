import { parseCsvToText } from "@/lib/parsers/csv-parser";
import { parseExcelToText } from "@/lib/parsers/excel-parser";
import { parsePdfToText } from "@/lib/parsers/pdf-parser";
import {
  extractStatementFromText,
  type StatementData,
} from "@/lib/parsers/transaction-extractor";

export type FileType = "pdf" | "csv" | "excel";

export function detectFileType(filename: string, mimeType: string): FileType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (lower.endsWith(".csv") || mimeType === "text/csv") return "csv";
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return "excel";
  }
  return null;
}

export async function parseStatement(
  userId: string,
  buffer: Buffer,
  fileType: FileType
): Promise<StatementData> {
  let text: string;
  if (fileType === "pdf") {
    text = await parsePdfToText(buffer);
  } else if (fileType === "csv") {
    text = parseCsvToText(buffer);
  } else {
    text = parseExcelToText(buffer);
  }

  if (!text.trim()) {
    return { transactions: [], primaryBalance: null, detectedAccounts: [] };
  }

  return extractStatementFromText(userId, text);
}
