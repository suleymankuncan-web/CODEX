import {
  KpiBenchmarkSource,
  KpiMetricDirection,
} from "./kpi-benchmark-scoring.contract";

export type KpiOwnerRole =
  | "DEPUTY_GM"
  | "REGION_MANAGER"
  | "STORE_MANAGER"
  | "STORE_PERSONNEL"
  | "VISUAL_TEAM";

export type KpiScoreBehavior =
  | "score_only"
  | "warning_first"
  | "task_candidate";

export type KpiScoreProfileMetric = {
  code: string;
  label: string;
  weightPercent: number;
  ownerRole: KpiOwnerRole;
  scoreBehavior: KpiScoreBehavior;
  direction?: KpiMetricDirection;
  benchmarkSource?: KpiBenchmarkSource;
  capRatio?: number;
  aliases?: string[];
  notes?: string;
};

export type KpiScoreProfile = {
  profileCode: "store" | "personnel";
  title: string;
  summary: string;
  metrics: KpiScoreProfileMetric[];
  futureMetricRule: string;
};

export type KpiGradingBand = {
  code: string;
  label: string;
  emoji: string;
  tone: "calm" | "accent" | "warning" | "danger" | "neutral";
  minScore: number;
};

export type KpiOwnershipMatrixRow = {
  code: string;
  label: string;
  visibleTo: KpiOwnerRole[];
  operationalOwner: KpiOwnerRole;
  contributesTo: Array<"store" | "personnel">;
  taskCandidate: boolean;
};

export const personnelTargetAchievementAliases = [
  "NET_SALES",
  "STORE_SALES",
  "SALES_TARGET_ACHIEVEMENT",
];

export const gsmApprovalKpiCode = "gsm_approval";
export const legacyGsmOnayKpiCode = "GSM_ONAY";
export const gsmApprovalKpiAliases = [legacyGsmOnayKpiCode, "gsm_onay"];

export function isGsmApprovalKpiCode(code: string | null | undefined) {
  const normalized = code?.trim();
  if (!normalized) {
    return false;
  }

  return (
    normalized === gsmApprovalKpiCode ||
    normalized === legacyGsmOnayKpiCode ||
    normalized.toLowerCase() === "gsm_onay"
  );
}

export function normalizeKpiScoreProfile(profile: KpiScoreProfile): KpiScoreProfile {
  if (profile.profileCode !== "personnel") {
    return profile;
  }

  return {
    ...profile,
    metrics: profile.metrics.map((metric) => {
      if (metric.code !== "TARGET_ACHIEVEMENT") {
        return metric;
      }

      return {
        ...metric,
        aliases: [...new Set([...personnelTargetAchievementAliases, ...(metric.aliases ?? [])])],
      };
    }),
  };
}

export const storeKpiScoreProfile: KpiScoreProfile = {
  profileCode: "store",
  title: "Store score profile",
  summary:
    "Store manager owns the operational scorecard for the current store. The score is weighted and ready for future metric additions.",
  metrics: [
    {
      code: "TARGET_ACHIEVEMENT",
      label: "Hedef gerceklestirme orani",
      weightPercent: 35,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "task_candidate",
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TARGET",
      capRatio: 1.2,
      aliases: ["STORE_SALES", "SALES_TARGET_ACHIEVEMENT"],
      notes: "Primary store score driver and strongest workflow candidate.",
    },
    {
      code: "CR",
      label: "CR",
      weightPercent: 20,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "task_candidate",
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
      notes: "Conversion health should remain visible and action-oriented.",
    },
    {
      code: "ATV",
      label: "ATV",
      weightPercent: 15,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "warning_first",
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
      notes:
        "Useful in score immediately; promote to tasks only if signal quality stays high.",
    },
    {
      code: "UPT",
      label: "UPT",
      weightPercent: 15,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "warning_first",
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
      notes: "Operationally important but should avoid inbox noise early.",
    },
    {
      code: "BM_CHECKLIST",
      label: "BM Checklist",
      weightPercent: 5,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "task_candidate",
      notes:
        "Compliance contributor that stays close to acknowledgement follow-up.",
    },
    {
      code: "VM_CHECKLIST",
      label: "VM Checklist",
      weightPercent: 5,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "task_candidate",
      notes:
        "Visual teams may produce the data, but the store manager carries the score outcome.",
    },
    {
      code: gsmApprovalKpiCode,
      label: "GSM Onayı",
      weightPercent: 5,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "warning_first",
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TARGET",
      capRatio: 1,
      aliases: gsmApprovalKpiAliases,
      notes: "Monthly store-level GSM approval contributor.",
    },
  ],
  futureMetricRule:
    "New metrics such as GSM approvals should be added through the KPI catalog and score profile, not hard-coded into one page.",
};

export const personnelKpiScoreProfile: KpiScoreProfile = {
  profileCode: "personnel",
  title: "Personnel score profile",
  summary:
    "Store personnel should have an individual scorecard that stays related to, but separate from, the store score.",
  metrics: [
    {
      code: "TARGET_ACHIEVEMENT",
      label: "Hedef gerceklestirme orani",
      weightPercent: 40,
      ownerRole: "STORE_PERSONNEL",
      scoreBehavior: "warning_first",
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TARGET",
      capRatio: 1.2,
      aliases: personnelTargetAchievementAliases,
      notes:
        "Primary personnel score driver and strongest coaching signal.",
    },
    {
      code: "ATV",
      label: "ATV",
      weightPercent: 30,
      ownerRole: "STORE_PERSONNEL",
      scoreBehavior: "warning_first",
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
      notes:
        "Useful for coaching and should not inherit store-level weighting by default.",
    },
    {
      code: "UPT",
      label: "UPT",
      weightPercent: 30,
      ownerRole: "STORE_PERSONNEL",
      scoreBehavior: "warning_first",
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
      notes:
        "Belongs in the personnel profile even before task triggers are enabled.",
    },
  ],
  futureMetricRule:
    "Personnel weights should live in the same rule system as store weights, but remain a separate profile.",
};

export const kpiOwnershipMatrix: KpiOwnershipMatrixRow[] = [
  {
    code: "TARGET_ACHIEVEMENT",
    label: "Hedef gerceklestirme orani",
    visibleTo: [
      "DEPUTY_GM",
      "REGION_MANAGER",
      "STORE_MANAGER",
      "STORE_PERSONNEL",
    ],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store", "personnel"],
    taskCandidate: true,
  },
  {
    code: "CR",
    label: "CR",
    visibleTo: ["DEPUTY_GM", "REGION_MANAGER", "STORE_MANAGER"],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store"],
    taskCandidate: true,
  },
  {
    code: "ATV",
    label: "ATV",
    visibleTo: [
      "DEPUTY_GM",
      "REGION_MANAGER",
      "STORE_MANAGER",
      "STORE_PERSONNEL",
    ],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store", "personnel"],
    taskCandidate: false,
  },
  {
    code: "UPT",
    label: "UPT",
    visibleTo: [
      "DEPUTY_GM",
      "REGION_MANAGER",
      "STORE_MANAGER",
      "STORE_PERSONNEL",
    ],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store", "personnel"],
    taskCandidate: false,
  },
  {
    code: "BM_CHECKLIST",
    label: "BM Checklist",
    visibleTo: ["REGION_MANAGER", "STORE_MANAGER"],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store"],
    taskCandidate: true,
  },
  {
    code: "VM_CHECKLIST",
    label: "VM Checklist",
    visibleTo: ["REGION_MANAGER", "STORE_MANAGER", "VISUAL_TEAM"],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store"],
    taskCandidate: true,
  },
  {
    code: gsmApprovalKpiCode,
    label: "GSM Onayı",
    visibleTo: ["DEPUTY_GM", "REGION_MANAGER", "STORE_MANAGER"],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store"],
    taskCandidate: false,
  },
];

export const kpiGradingBands: KpiGradingBand[] = [
  {
    code: "A",
    label: "Mukemmel",
    emoji: "🏆",
    tone: "calm",
    minScore: 1,
  },
  {
    code: "B",
    label: "Iyi",
    emoji: "🙂",
    tone: "accent",
    minScore: 0.85,
  },
  {
    code: "C",
    label: "Takip gerekli",
    emoji: "👀",
    tone: "warning",
    minScore: 0.75,
  },
  {
    code: "D",
    label: "Kritik",
    emoji: "🚨",
    tone: "danger",
    minScore: 0,
  },
];

export type KpiConfigPackage = {
  storeProfile: KpiScoreProfile;
  personnelProfile: KpiScoreProfile;
  ownershipMatrix: KpiOwnershipMatrixRow[];
  gradingBands: KpiGradingBand[];
};

export type KpiConfigVersionMetadata = {
  kpiConfigVersionId: string | null;
  versionNo: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
};

export type KpiConfigResponse = KpiConfigPackage & {
  metadata: KpiConfigVersionMetadata;
};

export type KpiConfigEditorResponse = {
  draftConfig: KpiConfigPackage;
  publishedConfig: KpiConfigPackage;
  hasUnpublishedChanges: boolean;
  latestPublishedVersion: KpiConfigVersionMetadata;
};
