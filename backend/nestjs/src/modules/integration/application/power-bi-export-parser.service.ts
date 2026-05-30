import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Worker } from "node:worker_threads";
import { AppConfigService } from "../../../shared/app-config.service";
import { logStructuredMessage } from "../../../shared/structured-log";

export type UploadFile = {
  originalname: string;
  buffer: Buffer;
};

export type ExportRow = Record<string, unknown>;

const PARSE_SLOT_CLEANUP_PROMISE = Symbol("parseSlotCleanupPromise");
type ParseSlotCleanupCarrier = {
  [PARSE_SLOT_CLEANUP_PROMISE]?: Promise<void>;
};

export const POWER_BI_EXPORT_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const POWER_BI_EXPORT_MAX_SHEET_ROWS = 20_000;
export const POWER_BI_EXPORT_MAX_SHEET_COLUMNS = 80;
export const POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS = 5;

const POWER_BI_EXPORT_ALLOWED_FILE_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const POWER_BI_EXPORT_PARSE_WORKER_SCRIPT = `
const { parentPort, workerData } = require("node:worker_threads");
const XLSX = require("@e965/xlsx");

function postFailure(message) {
  parentPort.postMessage({ ok: false, message });
}

function run() {
  try {
    const fileName = workerData.fileName || "unknown-file";
    const workbook = XLSX.read(Buffer.from(workerData.buffer), { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      parentPort.postMessage({ ok: true, rows: [] });
      return;
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rangeRef = sheet["!ref"];

    if (rangeRef) {
      let range;
      try {
        range = XLSX.utils.decode_range(rangeRef);
      } catch {
        postFailure("Power BI export calisma sayfasi okunamadi: " + fileName);
        return;
      }

      const rowCount = range.e.r - range.s.r + 1;
      const columnCount = range.e.c - range.s.c + 1;

      if (rowCount > workerData.maxRows) {
        postFailure("Power BI export dosyasi en fazla " + workerData.maxRows + " satir olabilir");
        return;
      }

      if (columnCount > workerData.maxColumns) {
        postFailure("Power BI export dosyasi en fazla " + workerData.maxColumns + " kolon olabilir");
        return;
      }
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      raw: true,
      defval: "",
    });
    parentPort.postMessage({ ok: true, rows });
  } catch {
    postFailure("Power BI export calisma sayfasi okunamadi: " + (workerData.fileName || "unknown-file"));
  }
}

run();
`;

type ParseWorkerMessage =
  | { ok: true; rows: ExportRow[] }
  | { ok: false; message: string };

export function isSupportedPowerBiExportFileName(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return POWER_BI_EXPORT_ALLOWED_FILE_EXTENSIONS.some((extension) =>
    normalized.endsWith(extension),
  );
}

@Injectable()
export class PowerBiExportParserService {
  private readonly logger = new Logger(PowerBiExportParserService.name);
  private activeParseSlots = 0;

  constructor(private readonly appConfigService: AppConfigService) {}

  async readUploadedRows(input: {
    sourceCode: string;
    personnelFile?: UploadFile | null;
    storeFile?: UploadFile | null;
  }): Promise<{ personnelRows: ExportRow[]; storeRows: ExportRow[] }> {
    return this.withParseSlot(async (signal) => {
      const personnelRows = input.personnelFile
        ? await this.readSheetRows(input.personnelFile, {
            fileRole: "personnel",
            sourceCode: input.sourceCode,
          }, signal)
        : [];
      const storeRows = input.storeFile
        ? await this.readSheetRows(input.storeFile, {
            fileRole: "store",
            sourceCode: input.sourceCode,
          }, signal)
        : [];

      return { personnelRows, storeRows };
    });
  }

  async readSheetRows(
    file: UploadFile,
    context: { fileRole: "personnel" | "store"; sourceCode: string },
    signal: AbortSignal,
  ): Promise<ExportRow[]> {
    const startedAt = Date.now();
    const rows = await this.parseSheetRows(file, signal);

    logStructuredMessage(this.logger, "power_bi_export_upload.parse.completed", {
      fileRole: context.fileRole,
      fileType: this.safeFileExtension(file.originalname),
      fileSizeBytes: file.buffer.length,
      parseDurationMs: Date.now() - startedAt,
      rowCount: rows.length,
      sourceCode: context.sourceCode,
    });

    return rows;
  }

  private async withParseSlot<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const maxConcurrency = this.appConfigService.uploadParseMaxConcurrency;

    if (this.activeParseSlots >= maxConcurrency) {
      throw this.buildRetryableParseException(
        "Power BI export isleme kapasitesi dolu; lutfen kisa sure sonra tekrar deneyin",
      );
    }

    this.activeParseSlots += 1;
    let releaseSlotImmediately = true;
    try {
      return await this.withParseTimeout(operation);
    } catch (error) {
      const cleanupPromise = this.getParseSlotCleanupPromise(error);
      if (cleanupPromise) {
        releaseSlotImmediately = false;
        void cleanupPromise.finally(() => {
          this.releaseParseSlot();
        });
      }
      throw error;
    } finally {
      if (releaseSlotImmediately) {
        this.releaseParseSlot();
      }
    }
  }

  private async withParseTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const timeoutMs = this.appConfigService.uploadParseTimeoutMs;
    const abortController = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    try {
      return await new Promise<T>((resolve, reject) => {
        const operationPromise = Promise.resolve().then(() =>
          operation(abortController.signal),
        );

        timeout = setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          abortController.abort();
          const timeoutError = this.buildRetryableParseException(
            "Power BI export dosyasi isleme suresi asildi; lutfen daha kucuk dosya yukleyin veya tekrar deneyin",
          );
          reject(
            this.withParseSlotCleanup(
              timeoutError,
              operationPromise.then(
                () => undefined,
                () => undefined,
              ),
            ),
          );
        }, timeoutMs);

        operationPromise.then(
          (result) => {
            if (settled) {
              return;
            }

            settled = true;
            resolve(result);
          },
          (error) => {
            if (settled) {
              return;
            }

            settled = true;
            reject(error);
          },
        );
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private buildRetryableParseException(message: string): HttpException {
    return new HttpException(
      {
        message,
        retryAfterSeconds: POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private releaseParseSlot(): void {
    this.activeParseSlots = Math.max(0, this.activeParseSlots - 1);
  }

  private withParseSlotCleanup(
    error: HttpException,
    cleanupPromise: Promise<void>,
  ): HttpException {
    Object.defineProperty(error, PARSE_SLOT_CLEANUP_PROMISE, {
      enumerable: false,
      value: cleanupPromise,
    });
    return error;
  }

  private getParseSlotCleanupPromise(error: unknown): Promise<void> | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }

    return (error as ParseSlotCleanupCarrier)[PARSE_SLOT_CLEANUP_PROMISE];
  }

  private parseSheetRows(file: UploadFile, signal: AbortSignal): Promise<ExportRow[]> {
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        `Dosya okunamadi: ${file.originalname || "unknown-file"}`,
      );
    }

    if (file.buffer.length > POWER_BI_EXPORT_MAX_FILE_BYTES) {
      throw new BadRequestException("Power BI export dosyasi en fazla 8 MB olabilir");
    }

    if (!isSupportedPowerBiExportFileName(file.originalname || "")) {
      throw new BadRequestException("Power BI export dosyasi xlsx, xls veya csv olmali");
    }

    if (signal.aborted) {
      return Promise.reject(
        this.buildRetryableParseException(
          "Power BI export dosyasi isleme suresi asildi; lutfen daha kucuk dosya yukleyin veya tekrar deneyin",
        ),
      );
    }

    return new Promise<ExportRow[]>((resolve, reject) => {
      let settled = false;
      const worker = new Worker(POWER_BI_EXPORT_PARSE_WORKER_SCRIPT, {
        eval: true,
        workerData: {
          buffer: file.buffer,
          fileName: file.originalname || "unknown-file",
          maxColumns: POWER_BI_EXPORT_MAX_SHEET_COLUMNS,
          maxRows: POWER_BI_EXPORT_MAX_SHEET_ROWS,
        },
      });

      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        signal.removeEventListener("abort", abortHandler);
        callback();
      };

      const abortHandler = () => {
        if (settled) {
          return;
        }

        settled = true;
        signal.removeEventListener("abort", abortHandler);
        const timeoutError = this.buildRetryableParseException(
          "Power BI export dosyasi isleme suresi asildi; lutfen daha kucuk dosya yukleyin veya tekrar deneyin",
        );
        void worker.terminate().then(
          () => reject(timeoutError),
          () => reject(timeoutError),
        );
      };

      signal.addEventListener("abort", abortHandler, { once: true });

      worker.once("message", (message: ParseWorkerMessage) => {
        settle(() => {
          if (message.ok) {
            resolve(message.rows);
            return;
          }

          reject(new BadRequestException(message.message));
        });
      });

      worker.once("error", (error) => {
        settle(() => reject(error));
      });

      worker.once("exit", (code) => {
        if (code === 0 || settled) {
          return;
        }

        settle(() =>
          reject(
            new BadRequestException(
              `Power BI export calisma sayfasi okunamadi: ${
                file.originalname || "unknown-file"
              }`,
            ),
          ),
        );
      });
    });
  }

  private safeFileExtension(fileName: string): string {
    const match = /\.[a-z0-9]+$/i.exec(fileName.trim());
    return match ? match[0].slice(1).toLowerCase() : "unknown";
  }
}
