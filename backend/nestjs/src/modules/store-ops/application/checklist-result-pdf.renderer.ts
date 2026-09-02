import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import PDFDocument = require("pdfkit");
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  CHECKLIST_RESULT_PDF_LIMITS,
  CONTENT_BOTTOM_OFFSET,
  CONTENT_WIDTH,
  FOOTER_OFFSET,
  NO_ANSWER,
  PDF_LABELS,
  PDF_TITLE,
  PAGE_MARGIN,
  buildChecklistResultPdfFileName,
  buildChecklistResultPdfProjection,
  formatNumber,
  visibleProjectionValues,
} from "./checklist-result-pdf.projection";
import type {
  ChecklistResultPdfInput,
  ChecklistResultPdfLabels,
  ChecklistResultPdfProjection,
  ChecklistResultPdfQuestion,
  ChecklistResultPdfSection,
} from "./checklist-result-pdf.projection";

export * from "./checklist-result-pdf.projection";

@Injectable()
export class ChecklistResultPdfRenderer {
  private readonly regularFontPath = resolve(
    __dirname,
    "../../../assets/fonts/NotoSans-Regular.otf",
  );

  private readonly boldFontPath = resolve(
    __dirname,
    "../../../assets/fonts/NotoSans-Bold.otf",
  );

  async render(input: ChecklistResultPdfInput): Promise<Buffer> {
    const projection = buildChecklistResultPdfProjection(input);
    this.assertRenderableInput(input, projection);
    this.assertFontsAvailable();

    const document = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      // PDFKit's repeated-word layout cache can emit invalid glyph positions
      // across buffered pages for embedded Unicode fonts.
      fontLayoutCache: false,
      info: {
        Title: PDF_TITLE,
        Author: "Store Ops",
        Creator: "Store Ops",
      },
    });

    return new Promise<Buffer>((resolveBuffer, reject) => {
      const chunks: Buffer[] = [];
      let settled = false;

      document.on("data", (chunk: Buffer | Uint8Array) => {
        if (!settled) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      });
      document.once("error", (error: Error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      document.once("end", () => {
        if (settled) {
          return;
        }

        settled = true;
        const buffer = Buffer.concat(chunks);
        if (buffer.length > CHECKLIST_RESULT_PDF_LIMITS.maxBytes) {
          reject(new UnprocessableEntityException("Checklist result PDF exceeds the safety bound"));
          return;
        }

        resolveBuffer(buffer);
      });

      try {
        this.writeDocument(document, projection);
        this.writeFooters(document);
        document.end();
      } catch (error) {
        if (!settled) {
          settled = true;
          reject(error);
        }
      }
    });
  }

  fileName(completedAt?: string | Date | null) {
    return buildChecklistResultPdfFileName(completedAt);
  }

  private assertRenderableInput(
    input: ChecklistResultPdfInput,
    projection: ChecklistResultPdfProjection,
  ) {
    const responses = Array.isArray(input.responses) ? input.responses : [];
    if (responses.length > CHECKLIST_RESULT_PDF_LIMITS.maxResponses) {
      throw new UnprocessableEntityException("Checklist result PDF exceeds the response safety bound");
    }

    let totalCharacters = 0;
    for (const value of visibleProjectionValues(projection)) {
      const characters = value.length;
      totalCharacters += characters;
      if (characters > CHECKLIST_RESULT_PDF_LIMITS.maxFieldCharacters) {
        throw new UnprocessableEntityException("Checklist result PDF contains an oversized field");
      }
      if (totalCharacters > CHECKLIST_RESULT_PDF_LIMITS.maxTotalCharacters) {
        throw new UnprocessableEntityException("Checklist result PDF exceeds the text safety bound");
      }
    }
  }

  private assertFontsAvailable() {
    if (!existsSync(this.regularFontPath) || !existsSync(this.boldFontPath)) {
      throw new Error("Checklist result PDF fonts are not available");
    }
  }

  private writeDocument(document: PDFKit.PDFDocument, projection: ChecklistResultPdfProjection) {
    document.font(this.regularFontPath).fontSize(10).fillColor("#202124");
    this.writeHeading(document, projection.title);
    if (projection.templateName) {
      this.writeSubheading(document, projection.templateName);
    }

    this.writeMetadata(document, projection.labels.category, projection.category);
    this.writeMetadata(document, projection.labels.store, projection.store);
    this.writeMetadata(document, projection.labels.completedAt, projection.completedAt);
    this.writeMetadata(document, projection.labels.completedBy, projection.completedBy);
    this.writeMetadata(document, projection.labels.score, projection.score);

    this.writeSubheading(document, projection.labels.sections);
    if (projection.sections.length === 0) {
      this.writeBlock(document, NO_ANSWER, { color: "#5f6368" });
    } else {
      for (const section of projection.sections) {
        this.writeSection(document, section);
        for (const question of section.questions) {
          this.writeQuestion(document, question, projection.labels);
        }
      }
    }

    if (projection.acknowledgement) {
      this.writeSubheading(document, projection.acknowledgement.label);
      this.writeBlock(document, projection.acknowledgement.status, { after: 1 });
      this.writeMetadata(
        document,
        projection.acknowledgement.acknowledgedAtLabel,
        projection.acknowledgement.acknowledgedAt,
      );
      this.writeMetadata(
        document,
        projection.acknowledgement.noteLabel,
        projection.acknowledgement.note,
      );
    }
  }

  private writeHeading(document: PDFKit.PDFDocument, text: string) {
    this.ensureSpace(document, 42);
    document.font(this.boldFontPath).fontSize(20).fillColor("#111827");
    document.text(text, { width: CONTENT_WIDTH });
    document.moveDown(0.45);
    document
      .moveTo(PAGE_MARGIN, document.y)
      .lineTo(document.page.width - PAGE_MARGIN, document.y)
      .lineWidth(1)
      .strokeColor("#d1d5db")
      .stroke();
    document.moveDown(0.55);
    document.font(this.regularFontPath).fontSize(10).fillColor("#202124");
  }

  private writeSubheading(document: PDFKit.PDFDocument, text: string) {
    this.ensureSpace(document, 28);
    document.font(this.boldFontPath).fontSize(13).fillColor("#1f2937");
    document.text(text, { width: CONTENT_WIDTH });
    document.moveDown(0.25);
    document.font(this.regularFontPath).fontSize(10).fillColor("#202124");
  }

  private writeSection(document: PDFKit.PDFDocument, section: ChecklistResultPdfSection) {
    const score = `${formatNumber(section.earnedPoints)}/${formatNumber(section.maxPoints)} ${PDF_LABELS.points} (${section.percent}%)`;
    this.ensureSpace(document, 32);
    document.font(this.boldFontPath).fontSize(11).fillColor("#374151");
    document.text(section.name, { width: CONTENT_WIDTH });
    document.moveDown(0.1);
    document.font(this.regularFontPath).fontSize(10).fillColor("#4b5563");
    document.text(score, { width: CONTENT_WIDTH });
    document.moveDown(0.3);
    document.font(this.regularFontPath).fontSize(10).fillColor("#202124");
  }

  private writeQuestion(
    document: PDFKit.PDFDocument,
    question: ChecklistResultPdfQuestion,
    labels: ChecklistResultPdfLabels,
  ) {
    const title = question.itemNo === undefined
      ? question.itemText
      : `${question.itemNo}. ${question.itemText}`;
    const blocks: Array<{
      text: string;
      bold?: boolean;
      color?: string;
      indent?: number;
      after?: number;
    }> = [
      { text: title, bold: true, after: 2 },
      { text: `${labels.answer}: ${question.answer}`, indent: 12, after: 1 },
      {
        text: `${labels.points}: ${question.score}`,
        indent: 12,
        color: "#4b5563",
        after: 6,
      },
    ];

    const blockHeight = blocks.reduce(
      (height, block) => height + this.measureBlock(document, block),
      0,
    );
    const usableHeight = document.page.height - PAGE_MARGIN - CONTENT_BOTTOM_OFFSET;
    if (blockHeight <= usableHeight) {
      this.ensureSpace(document, blockHeight);
    }

    for (const block of blocks) {
      this.writeBlock(document, block.text, block);
    }
  }

  private measureBlock(
    document: PDFKit.PDFDocument,
    options: { text: string; bold?: boolean; indent?: number; after?: number },
  ) {
    const indent = options.indent ?? 0;
    const width = CONTENT_WIDTH - indent;
    document
      .font(options.bold ? this.boldFontPath : this.regularFontPath)
      .fontSize(10);
    // PDFKit's heightOfString can advance to a new page when measured near the
    // current page bottom. Measure against a fixed, bounded canvas so layout
    // calculation never mutates the document's page state.
    const originalX = document.x;
    const originalY = document.y;
    const height = document.boundsOfString(
      options.text,
      PAGE_MARGIN + indent,
      PAGE_MARGIN,
      {
        width,
        lineGap: 2,
        height: CHECKLIST_RESULT_PDF_LIMITS.maxTotalCharacters,
      },
    ).height;
    document.x = originalX;
    document.y = originalY;
    const after = options.after
      ? document.currentLineHeight() * (options.after / 10)
      : 0;
    return height + after;
  }

  private writeMetadata(document: PDFKit.PDFDocument, label: string, value: string | null | undefined) {
    this.writeBlock(document, `${label}: ${value || "Bilinmiyor"}`, { after: 1 });
  }

  private writeBlock(
    document: PDFKit.PDFDocument,
    text: string,
    options: { bold?: boolean; color?: string; indent?: number; after?: number } = {},
  ) {
    const indent = options.indent ?? 0;
    const width = CONTENT_WIDTH - indent;
    document
      .font(options.bold ? this.boldFontPath : this.regularFontPath)
      .fontSize(10)
      .fillColor(options.color ?? "#202124");
    const height = this.measureBlock(document, {
      text,
      bold: options.bold,
      indent,
    });
    if (height <= document.page.height - PAGE_MARGIN * 2) {
      this.ensureSpace(document, height + (options.after ?? 0));
    }

    document.text(text, PAGE_MARGIN + indent, document.y, {
      width,
      lineGap: 2,
    });
    if (options.after) {
      document.moveDown(options.after / 10);
    }
  }

  private ensureSpace(document: PDFKit.PDFDocument, requiredHeight: number) {
    const bottom = document.page.height - CONTENT_BOTTOM_OFFSET;
    if (document.y > PAGE_MARGIN && document.y + requiredHeight > bottom) {
      document.addPage({ size: "A4", margin: PAGE_MARGIN });
      document.font(this.regularFontPath).fontSize(10).fillColor("#202124");
    }
  }

  private writeFooters(document: PDFKit.PDFDocument) {
    const pages = document.bufferedPageRange();
    if (pages.count > CHECKLIST_RESULT_PDF_LIMITS.maxPages) {
      throw new UnprocessableEntityException("Checklist result PDF exceeds the page safety bound");
    }

    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      document.switchToPage(index);
      const originalBottomMargin = document.page.margins.bottom;
      document.page.margins.bottom = 0;
      document.font(this.regularFontPath).fontSize(8).fillColor("#6b7280");
      document.text(
        `${PDF_LABELS.page} ${index - pages.start + 1} / ${pages.count}`,
        PAGE_MARGIN,
        document.page.height - FOOTER_OFFSET,
        {
          width: CONTENT_WIDTH,
          align: "center",
          lineBreak: false,
        },
      );
      document.page.margins.bottom = originalBottomMargin;
    }
  }
}
