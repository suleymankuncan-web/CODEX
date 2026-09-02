export type ChecklistResultPdfResponse = {
  templateItemId?: string | null;
  sectionName?: string | null;
  itemNo?: number | string | null;
  itemText?: string | null;
  responseType?: string | null;
  weight?: number | string | null;
  maxScore?: number | string | null;
  responseValue?: string | null;
  scoreValue?: number | string | null;
  commentText?: string | null;
};

export type ChecklistResultPdfAcknowledgement = {
  checklistAcknowledgementId?: string | null;
  acknowledgedByUserId?: string | null;
  acknowledgementNote?: string | null;
  acknowledgedAt?: string | Date | null;
};

export type ChecklistResultPdfInput = {
  checklistInstanceId?: string | null;
  templateName?: string | null;
  templateType?: string | null;
  category?: string | null;
  storeName?: string | null;
  completedByUserId?: string | null;
  completedByDisplayName?: string | null;
  completedAt?: string | Date | null;
  status?: string | null;
  totalScore?: number | string | null;
  complianceRate?: number | string | null;
  responses?: ChecklistResultPdfResponse[] | null;
  acknowledgement?: ChecklistResultPdfAcknowledgement | null;
};

export type ChecklistResultPdf = {
  buffer: Buffer;
  fileName: string;
};

export type ChecklistResultPdfQuestion = {
  itemNo?: number;
  itemText: string;
  answer: string;
  score: string;
};

export type ChecklistResultPdfSection = {
  name: string;
  questions: ChecklistResultPdfQuestion[];
  earnedPoints: number;
  maxPoints: number;
  percent: number;
};

export type ChecklistResultPdfAcknowledgementProjection = {
  label: "Mağaza kabulü";
  status: "Kabul edildi";
  acknowledgedAtLabel: "Kabul tarihi";
  acknowledgedAt: string;
  noteLabel: "Not";
  note: string;
};

export type ChecklistResultPdfLabels = {
  category: "Kategori";
  store: "Mağaza";
  completedAt: "Tamamlanma";
  completedBy: "Tamamlayan";
  score: "Skor";
  sections: "Bölümler";
  answer: "Cevap";
  points: "Puan";
  acknowledgement: "Mağaza kabulü";
  acknowledged: "Kabul edildi";
  acknowledgedAt: "Kabul tarihi";
  note: "Not";
  page: "Sayfa";
};

export type ChecklistResultPdfProjection = {
  title: "Kontrol Listesi Sonucu";
  labels: ChecklistResultPdfLabels;
  templateType?: undefined;
  templateName?: string;
  category: string;
  store: string;
  completedAt: string;
  completedBy: string;
  score: string;
  sections: ChecklistResultPdfSection[];
  acknowledgement?: ChecklistResultPdfAcknowledgementProjection;
};

export const PAGE_MARGIN = 48;
export const FOOTER_OFFSET = 30;
export const CONTENT_BOTTOM_OFFSET = 62;
export const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;

/**
 * These bounds are deliberately explicit: a result that cannot be rendered in
 * a bounded request is rejected instead of returning a truncated document.
 */
export const CHECKLIST_RESULT_PDF_LIMITS = {
  maxResponses: 1_000,
  maxFieldCharacters: 20_000,
  maxTotalCharacters: 1_000_000,
  maxPages: 200,
  maxBytes: 15 * 1024 * 1024,
} as const;

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const BIDI_FORMAT_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export const PDF_LABELS: ChecklistResultPdfLabels = {
  category: "Kategori",
  store: "Mağaza",
  completedAt: "Tamamlanma",
  completedBy: "Tamamlayan",
  score: "Skor",
  sections: "Bölümler",
  answer: "Cevap",
  points: "Puan",
  acknowledgement: "Mağaza kabulü",
  acknowledged: "Kabul edildi",
  acknowledgedAt: "Kabul tarihi",
  note: "Not",
  page: "Sayfa",
};

export const PDF_TITLE = "Kontrol Listesi Sonucu" as const;
export const NO_ANSWER = "Yanıt yok" as const;
export const NO_SCORE = "Puan yok" as const;

/**
 * Builds the only data model the PDF renderer consumes. Input identifiers,
 * internal template types, and comments that are not rendered are deliberately
 * discarded here so they cannot leak into the document or safety accounting.
 */
export function buildChecklistResultPdfProjection(
  input: ChecklistResultPdfInput,
): ChecklistResultPdfProjection {
  const sourceResponses = Array.isArray(input.responses) ? input.responses : [];
  const sections: ChecklistResultPdfSection[] = [];
  const sectionsByName = new Map<string, ChecklistResultPdfSection>();

  for (const response of sourceResponses) {
    const sectionName = visibleValue(response.sectionName) || "Bilinmiyor";
    let section = sectionsByName.get(sectionName);
    if (!section) {
      section = {
        name: sectionName,
        questions: [],
        earnedPoints: 0,
        maxPoints: 0,
        percent: 0,
      };
      sectionsByName.set(sectionName, section);
      sections.push(section);
    }

    const answer = mapAnswer(response);
    const weighted = getWeightedPoints(response);
    const itemNo = finiteNumber(response.itemNo);
    const question: ChecklistResultPdfQuestion = {
      ...(itemNo === null ? {} : { itemNo }),
      itemText: visibleValue(response.itemText) || "Bilinmiyor",
      answer,
      score: scoreLabel(response, weighted),
    };
    section.questions.push(question);

    if (weighted) {
      section.earnedPoints += weighted.earnedPoints;
      section.maxPoints += weighted.maxPoints;
    }
  }

  for (const section of sections) {
    section.earnedPoints = roundMetric(section.earnedPoints);
    section.maxPoints = roundMetric(section.maxPoints);
    section.percent = section.maxPoints > 0
      ? Math.round((section.earnedPoints / section.maxPoints) * 100)
      : 0;
  }

  const acknowledgement = input.acknowledgement
    ? {
        label: PDF_LABELS.acknowledgement,
        status: PDF_LABELS.acknowledged,
        acknowledgedAtLabel: PDF_LABELS.acknowledgedAt,
        acknowledgedAt: formatDateTime(input.acknowledgement.acknowledgedAt),
        noteLabel: PDF_LABELS.note,
        note: visibleValue(input.acknowledgement.acknowledgementNote) || "Bilinmiyor",
      }
    : undefined;

  const templateName = visibleValue(input.templateName);
  return {
    title: PDF_TITLE,
    labels: PDF_LABELS,
    ...(templateName ? { templateName } : {}),
    category: visibleValue(input.category) || "Bilinmiyor",
    store: visibleValue(input.storeName) || "Bilinmiyor",
    completedAt: formatDateTime(input.completedAt),
    completedBy: safeDisplayName(input.completedByDisplayName),
    score: overallScore(input),
    sections,
    ...(acknowledgement ? { acknowledgement } : {}),
  };
}

export function visibleProjectionValues(projection: ChecklistResultPdfProjection) {
  const values: string[] = [
    projection.title,
    projection.templateName ?? "",
    projection.category,
    projection.store,
    projection.completedAt,
    projection.completedBy,
    projection.score,
    projection.labels.category,
    projection.labels.store,
    projection.labels.completedAt,
    projection.labels.completedBy,
    projection.labels.score,
    projection.labels.sections,
    projection.labels.answer,
    projection.labels.points,
  ];

  for (const section of projection.sections) {
    values.push(section.name, formatNumber(section.earnedPoints), formatNumber(section.maxPoints), `${section.percent}%`);
    for (const question of section.questions) {
      values.push(question.itemText, question.answer, question.score);
    }
  }

  if (projection.acknowledgement) {
    values.push(
      projection.acknowledgement.label,
      projection.acknowledgement.status,
      projection.acknowledgement.acknowledgedAtLabel,
      projection.acknowledgement.acknowledgedAt,
      projection.acknowledgement.noteLabel,
      projection.acknowledgement.note,
    );
  }

  return values;
}

function safeDisplayName(value: string | null | undefined) {
  const visible = visibleValue(value);
  if (!visible || UUID_PATTERN.test(visible)) {
    UUID_PATTERN.lastIndex = 0;
    return "Bilinmiyor";
  }
  UUID_PATTERN.lastIndex = 0;
  return visible;
}

function mapAnswer(response: ChecklistResultPdfResponse) {
  const type = responseType(response);
  if (type === "text") {
    return visibleValue(response.commentText) || NO_ANSWER;
  }

  const score = finiteNumber(response.scoreValue);
  if (score === null) {
    return NO_ANSWER;
  }

  switch (type) {
    case "compliance":
      switch (normalizedResponseValue(response)) {
        case "compliant":
          return "Uygun";
        case "partially_compliant":
          return "Kısmen Uygun";
        case "non_compliant":
          return "Uygun Değil";
        case "not_applicable":
          return "N/A";
        default:
          return NO_ANSWER;
      }
    case "yes_no":
    case "boolean":
      return score > 0 ? "Evet" : "Hayır";
    case "partial": {
      const ratio = responseRatio(response);
      if (ratio === null) {
        return NO_ANSWER;
      }
      if (ratio >= 80) {
        return "Uygun";
      }
      if (ratio >= 40) {
        return "Takip";
      }
      return "Kritik";
    }
    default:
      return formatNumber(score);
  }
}

function scoreLabel(
  response: ChecklistResultPdfResponse,
  weighted: { earnedPoints: number; maxPoints: number } | null,
) {
  if (normalizedResponseValue(response) === "not_applicable") {
    return "Puan dışı";
  }
  if (!weighted) {
    return NO_SCORE;
  }
  return `${formatNumber(weighted.earnedPoints)}/${formatNumber(weighted.maxPoints)}`;
}

function getWeightedPoints(response: ChecklistResultPdfResponse) {
  if (normalizedResponseValue(response) === "not_applicable") {
    return null;
  }

  const score = finiteNumber(response.scoreValue);
  const maxScore = finiteNumber(response.maxScore);
  if (score === null || maxScore === null || maxScore <= 0) {
    return null;
  }

  const weight = getChecklistItemWeight(response.weight);
  return {
    earnedPoints: (score / maxScore) * weight,
    maxPoints: weight,
  };
}

function getChecklistItemWeight(weight: unknown) {
  const value = finiteNumber(weight);
  return value !== null && value > 0 ? value : 1;
}

function overallScore(input: ChecklistResultPdfInput) {
  const totalScore = finiteNumber(input.totalScore);
  if (totalScore !== null) {
    return formatNumber(totalScore);
  }

  const complianceRate = finiteNumber(input.complianceRate);
  if (complianceRate === null) {
    return NO_SCORE;
  }

  const percent = complianceRate <= 1 ? complianceRate * 100 : complianceRate;
  return formatNumber(Math.round(percent));
}

function normalizedResponseValue(response: ChecklistResultPdfResponse) {
  return visibleValue(response.responseValue).toLowerCase();
}

function responseType(response: ChecklistResultPdfResponse) {
  return visibleValue(response.responseType).toLowerCase();
}

function responseRatio(response: ChecklistResultPdfResponse) {
  const score = finiteNumber(response.scoreValue);
  const maxScore = finiteNumber(response.maxScore);
  if (score === null || maxScore === null || maxScore <= 0) {
    return null;
  }
  return Math.round((score / maxScore) * 100);
}

function visibleValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  UUID_PATTERN.lastIndex = 0;
  return stripControlCharacters(
    String(value)
      .replace(UUID_PATTERN, "")
      .replace(/[\u2013\u2014]/g, "-")
      .trim(),
  );
}

function stripControlCharacters(value: string) {
  return [...value.replace(BIDI_FORMAT_CONTROLS, "")]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code !== 0x7f && (code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d);
    })
    .join("");
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundMetric(value: number) {
  return Number(value.toFixed(12));
}

export function formatNumber(value: unknown) {
  const number = finiteNumber(value);
  if (number === null) {
    return NO_SCORE;
  }
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(number);
}

function formatDateTime(value: string | Date | null | undefined) {
  const date = parseDate(value);
  if (!date) {
    return "Bilinmiyor";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileDate(value: string | Date | null | undefined) {
  const date = parseDate(value) ?? new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildChecklistResultPdfFileName(value: string | Date | null | undefined) {
  return `checklist-result-${formatFileDate(value)}.pdf`;
}

function parseDate(value: string | Date | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
