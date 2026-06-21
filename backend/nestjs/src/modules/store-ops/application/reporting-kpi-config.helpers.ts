import { BadRequestException } from "@nestjs/common";
import {
  KpiGradingBand,
  KpiOwnershipMatrixRow,
  kpiGradingBands,
  KpiScoreProfile,
  kpiOwnershipMatrix,
  normalizeKpiScoreProfile,
  personnelKpiScoreProfile,
  storeKpiScoreProfile,
} from "./kpi-config.contract";

export function resolveKpiConfigFromRows(
  rows: Array<{
    config_key: string;
    config_payload: unknown;
  }>,
) {
  const configMap = new Map(rows.map((row) => [row.config_key, row.config_payload]));
  const storeProfile = configMap.get("store_profile") ?? configMap.get("draft_store_profile");
  const personnelProfile =
    configMap.get("personnel_profile") ?? configMap.get("draft_personnel_profile");
  const ownershipMatrixPayload =
    configMap.get("ownership_matrix") ?? configMap.get("draft_ownership_matrix");
  const gradingBandsPayload =
    configMap.get("grading_bands") ?? configMap.get("draft_grading_bands");

  if (storeProfile && personnelProfile && ownershipMatrixPayload && gradingBandsPayload) {
    return {
      storeProfile: normalizeKpiScoreProfile(storeProfile as KpiScoreProfile),
      personnelProfile: normalizeKpiScoreProfile(personnelProfile as KpiScoreProfile),
      ownershipMatrix: ownershipMatrixPayload as KpiOwnershipMatrixRow[],
      gradingBands: gradingBandsPayload as KpiGradingBand[],
    };
  }

  return getDefaultKpiConfig();
}

export function mapKpiConfigVersionMetadata(version: {
  kpi_config_version_id: string;
  version_no: number;
  effective_from: string;
  effective_to: string | null;
  published_at: string;
  published_by: string | null;
} | null) {
  return {
    kpiConfigVersionId: version?.kpi_config_version_id ?? null,
    versionNo: version?.version_no ?? null,
    effectiveFrom: version?.effective_from ?? null,
    effectiveTo: version?.effective_to ?? null,
    publishedAt: version?.published_at ?? null,
    publishedBy: version?.published_by ?? null,
  };
}

export function getDefaultKpiConfig() {
  return {
    storeProfile: normalizeKpiScoreProfile(storeKpiScoreProfile),
    personnelProfile: normalizeKpiScoreProfile(personnelKpiScoreProfile),
    ownershipMatrix: kpiOwnershipMatrix,
    gradingBands: kpiGradingBands,
  };
}

export async function resolveKpiConfigForSnapshot(input: {
  snapshotRunId?: string;
  getCurrentKpiConfig: () => Promise<ReturnType<typeof getDefaultKpiConfig>>;
  getSnapshotRunKpiConfigVersionId: (snapshotRunId: string) => Promise<string | null>;
  getKpiConfigVersionById: (kpiConfigVersionId: string) => Promise<{
    config_payload?: {
      storeProfile?: unknown;
      personnelProfile?: unknown;
      ownershipMatrix?: unknown;
      gradingBands?: unknown;
    } | null;
  } | null>;
}) {
  if (!input.snapshotRunId) {
    return input.getCurrentKpiConfig();
  }

  const kpiConfigVersionId = await input.getSnapshotRunKpiConfigVersionId(
    input.snapshotRunId,
  );

  if (!kpiConfigVersionId) {
    return input.getCurrentKpiConfig();
  }

  const version = await input.getKpiConfigVersionById(kpiConfigVersionId);
  const payload = version?.config_payload;

  if (!payload?.storeProfile) {
    return input.getCurrentKpiConfig();
  }

  const defaults = getDefaultKpiConfig();
  return {
    ...defaults,
    storeProfile: normalizeKpiScoreProfile(payload.storeProfile as KpiScoreProfile),
    personnelProfile: payload.personnelProfile
      ? normalizeKpiScoreProfile(payload.personnelProfile as KpiScoreProfile)
      : defaults.personnelProfile,
    ownershipMatrix: payload.ownershipMatrix ?? defaults.ownershipMatrix,
    gradingBands: payload.gradingBands ?? defaults.gradingBands,
  };
}

export function createSnapshotKpiConfigProvider(
  getCurrentKpiConfig: () => Promise<ReturnType<typeof getDefaultKpiConfig>>,
  storeScoreReportingReadRepository: {
    getSnapshotRunKpiConfigVersionId(input: { snapshotRunId: string }): Promise<string | null>;
  },
  kpiConfigRepository: {
    getKpiConfigVersionById(kpiConfigVersionId: string): Promise<{
      config_payload?: {
        storeProfile?: unknown;
        personnelProfile?: unknown;
        ownershipMatrix?: unknown;
        gradingBands?: unknown;
      } | null;
    } | null>;
  },
) {
  return ({ snapshotRunId }: { snapshotRunId?: string } = {}) =>
    resolveKpiConfigForSnapshot({
      snapshotRunId,
      getCurrentKpiConfig,
      getSnapshotRunKpiConfigVersionId: (snapshotRunId) =>
        storeScoreReportingReadRepository.getSnapshotRunKpiConfigVersionId({
          snapshotRunId,
        }),
      getKpiConfigVersionById: (kpiConfigVersionId) =>
        kpiConfigRepository.getKpiConfigVersionById(kpiConfigVersionId),
    });
}

export function validateKpiConfigInput(input: {
  storeProfile: unknown;
  personnelProfile: unknown;
  ownershipMatrix: unknown;
  gradingBands: unknown;
}) {
  const storeProfile = input.storeProfile as KpiScoreProfile;
  const personnelProfile = input.personnelProfile as KpiScoreProfile;
  const ownershipMatrix = input.ownershipMatrix as KpiOwnershipMatrixRow[];
  const gradingBands = input.gradingBands as KpiGradingBand[];

  validateProfile(storeProfile, {
    expectedCode: "store",
    exactTotal: 100,
    label: "storeProfile",
  });
  validateProfile(personnelProfile, {
    expectedCode: "personnel",
    exactTotal: 100,
    label: "personnelProfile",
  });
  validateOwnershipMatrix(storeProfile, personnelProfile, ownershipMatrix);
  validateGradingBands(gradingBands);
}

function validateProfile(
  profile: KpiScoreProfile,
  rules: {
    expectedCode: "store" | "personnel";
    label: string;
    exactTotal?: number;
    maxTotal?: number;
  },
) {
  if (!profile || profile.profileCode !== rules.expectedCode) {
    throw new BadRequestException(`${rules.label} profileCode is invalid.`);
  }

  if (!Array.isArray(profile.metrics) || profile.metrics.length === 0) {
    throw new BadRequestException(`${rules.label} must contain at least one metric.`);
  }

  const seenCodes = new Set<string>();
  const totalWeight = profile.metrics.reduce((sum, metric) => {
    const normalizedCode = metric.code?.trim();
    const normalizedLabel = metric.label?.trim();

    if (!normalizedCode || !normalizedLabel) {
      throw new BadRequestException(
        `${rules.label} contains a metric with empty code or label.`,
      );
    }

    if (seenCodes.has(normalizedCode)) {
      throw new BadRequestException(
        `${rules.label} contains duplicate metric code "${normalizedCode}".`,
      );
    }
    seenCodes.add(normalizedCode);

    if (!Number.isFinite(metric.weightPercent) || metric.weightPercent < 0) {
      throw new BadRequestException(
        `${rules.label} metric "${normalizedCode}" has invalid weightPercent.`,
      );
    }

    return sum + metric.weightPercent;
  }, 0);

  if (rules.exactTotal !== undefined && totalWeight !== rules.exactTotal) {
    throw new BadRequestException(
      `${rules.label} weight total must equal ${rules.exactTotal}.`,
    );
  }

  if (rules.maxTotal !== undefined && totalWeight > rules.maxTotal) {
    throw new BadRequestException(
      `${rules.label} weight total cannot exceed ${rules.maxTotal}.`,
    );
  }
}

function validateOwnershipMatrix(
  storeProfile: KpiScoreProfile,
  personnelProfile: KpiScoreProfile,
  ownershipMatrix: KpiOwnershipMatrixRow[],
) {
  if (!Array.isArray(ownershipMatrix) || ownershipMatrix.length === 0) {
    throw new BadRequestException("ownershipMatrix must contain at least one row.");
  }

  const metricCodes = new Set([
    ...storeProfile.metrics.map((metric) => metric.code.trim()),
    ...personnelProfile.metrics.map((metric) => metric.code.trim()),
  ]);
  const seenRows = new Set<string>();

  for (const row of ownershipMatrix) {
    const code = row.code?.trim();
    const label = row.label?.trim();

    if (!code || !label) {
      throw new BadRequestException(
        "ownershipMatrix contains a row with empty code or label.",
      );
    }

    if (seenRows.has(code)) {
      throw new BadRequestException(
        `ownershipMatrix contains duplicate code "${code}".`,
      );
    }
    seenRows.add(code);

    if (!metricCodes.has(code)) {
      throw new BadRequestException(
        `ownershipMatrix code "${code}" is not present in any KPI profile.`,
      );
    }

    if (!Array.isArray(row.visibleTo) || row.visibleTo.length === 0) {
      throw new BadRequestException(
        `ownershipMatrix row "${code}" must define at least one visibleTo role.`,
      );
    }

    if (!Array.isArray(row.contributesTo) || row.contributesTo.length === 0) {
      throw new BadRequestException(
        `ownershipMatrix row "${code}" must define contributesTo.`,
      );
    }
  }
}

function validateGradingBands(gradingBands: KpiGradingBand[]) {
  if (!Array.isArray(gradingBands) || gradingBands.length === 0) {
    throw new BadRequestException("gradingBands must contain at least one row.");
  }

  const seenCodes = new Set<string>();
  let lastMinScore = Number.POSITIVE_INFINITY;

  for (const band of gradingBands) {
    const code = band.code?.trim();
    const label = band.label?.trim();
    const emoji = band.emoji?.trim();

    if (!code || !label || !emoji) {
      throw new BadRequestException(
        "gradingBands contains a row with empty code, label, or emoji.",
      );
    }

    if (seenCodes.has(code)) {
      throw new BadRequestException(
        `gradingBands contains duplicate code "${code}".`,
      );
    }
    seenCodes.add(code);

    if (!Number.isFinite(band.minScore) || band.minScore < 0) {
      throw new BadRequestException(
        `gradingBands row "${code}" has invalid minScore.`,
      );
    }

    if (band.minScore > lastMinScore) {
      throw new BadRequestException(
        "gradingBands must be sorted from highest minScore to lowest.",
      );
    }

    lastMinScore = band.minScore;
  }
}
