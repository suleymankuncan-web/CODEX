import { Injectable } from "@nestjs/common";
import { type ExportRow } from "./power-bi-export-parser.service";

@Injectable()
export class PowerBiExportNormalizerService {
  getText(row: ExportRow, aliases: string[]) {
    const value = this.getValue(row, aliases);
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }

  getNumber(row: ExportRow, aliases: string[]) {
    const value = this.getValue(row, aliases);
    if (value === null || value === undefined || String(value).trim() === "") {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const normalized = String(value)
      .replace(/\s+/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  roundMetric(value: number) {
    return Number(value.toFixed(4));
  }

  divideMetric(numerator: number, denominator: number) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }

    return this.roundMetric(numerator / denominator);
  }

  normalizeKey(value: string) {
    return value
      .replace(/ı/g, "i")
      .replace(/İ/g, "I")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  private getValue(row: ExportRow, aliases: string[]) {
    const aliasSet = new Set(aliases.map((alias) => this.normalizeKey(alias)));

    for (const [key, value] of Object.entries(row)) {
      if (aliasSet.has(this.normalizeKey(key))) {
        return value;
      }
    }

    return null;
  }
}
