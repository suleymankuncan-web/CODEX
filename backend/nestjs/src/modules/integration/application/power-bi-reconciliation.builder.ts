import { type ExportRow } from "./power-bi-export-parser.service";
import { type PowerBiExportNormalizerService } from "./power-bi-export-normalizer.service";

type PowerBiReconciliationNormalizer = Pick<
  PowerBiExportNormalizerService,
  "getText" | "getNumber" | "normalizeKey" | "roundMetric"
>;

type PowerBiReconciliationStoreScope = {
  externalRefKeys: Set<string>;
};

type ReconciliationMovement = {
  storeName: string;
  personnelPositiveSales: number;
  personnelNegativeMovements: number;
};

export type PowerBiReconciliationItem = {
  storeExternalRef: string;
  storeNetSales: number;
  personnelPositiveSales: number;
  personnelNegativeMovements: number;
  personnelNetMovement: number;
  reconciliationDelta: number;
  status: "balanced" | "warning";
};

export type PowerBiReconciliationSummary = {
  comparedStoreCount: number;
  balancedStoreCount: number;
  warningStoreCount: number;
  items: PowerBiReconciliationItem[];
};

export function buildPowerBiReconciliationSummary(input: {
  storeRows: ExportRow[];
  personnelRows: ExportRow[];
  storeScope: PowerBiReconciliationStoreScope;
  normalizer: PowerBiReconciliationNormalizer;
}): PowerBiReconciliationSummary {
  const { storeRows, personnelRows, storeScope, normalizer } = input;
  const storeNetSalesByKey = new Map<string, { storeName: string; storeNetSales: number }>();
  const personnelMovementByKey = new Map<string, ReconciliationMovement>();

  for (const row of storeRows) {
    const storeName = getStoreName(row, normalizer);
    if (
      !storeName ||
      isSummaryText(storeName, normalizer) ||
      !isStoreInKpiImportScope(storeName, storeScope, normalizer)
    ) {
      continue;
    }

    const key = normalizer.normalizeKey(storeName);
    const existing = storeNetSalesByKey.get(key) ?? { storeName, storeNetSales: 0 };
    existing.storeNetSales += getStoreNetSales(row, normalizer) ?? 0;
    storeNetSalesByKey.set(key, existing);
  }

  for (const row of personnelRows) {
    const personName = getPersonName(row, normalizer);
    const storeName = getStoreName(row, normalizer);
    const salesAmount = getPersonnelSalesAmount(row, normalizer);
    if (
      !personName ||
      !storeName ||
      isSummaryText(personName, normalizer) ||
      !isStoreInKpiImportScope(storeName, storeScope, normalizer) ||
      salesAmount === null ||
      salesAmount === 0
    ) {
      continue;
    }

    const key = normalizer.normalizeKey(storeName);
    const movement =
      personnelMovementByKey.get(key) ??
      {
        storeName,
        personnelPositiveSales: 0,
        personnelNegativeMovements: 0,
      };

    if (salesAmount > 0 && normalizer.normalizeKey(personName) !== "estore") {
      movement.personnelPositiveSales += salesAmount;
    }
    if (salesAmount < 0) {
      movement.personnelNegativeMovements += salesAmount;
    }
    personnelMovementByKey.set(key, movement);
  }

  const items: PowerBiReconciliationItem[] = [...storeNetSalesByKey.entries()].flatMap(([key, store]) => {
    const movement = personnelMovementByKey.get(key);
    if (!movement) {
      return [];
    }

    const personnelPositiveSales = normalizer.roundMetric(movement.personnelPositiveSales);
    const personnelNegativeMovements = normalizer.roundMetric(
      movement.personnelNegativeMovements,
    );
    const personnelNetMovement = normalizer.roundMetric(
      personnelPositiveSales + personnelNegativeMovements,
    );
    const storeNetSales = normalizer.roundMetric(store.storeNetSales);
    const reconciliationDelta = normalizer.roundMetric(storeNetSales - personnelNetMovement);
    const status: PowerBiReconciliationItem["status"] =
      Math.abs(reconciliationDelta) <= 0.01 ? "balanced" : "warning";

    return [
      {
        storeExternalRef: store.storeName,
        storeNetSales,
        personnelPositiveSales,
        personnelNegativeMovements,
        personnelNetMovement,
        reconciliationDelta,
        status,
      },
    ];
  });

  return {
    comparedStoreCount: items.length,
    balancedStoreCount: items.filter((item) => item.status === "balanced").length,
    warningStoreCount: items.filter((item) => item.status === "warning").length,
    items,
  };
}

function getPersonName(row: ExportRow, normalizer: PowerBiReconciliationNormalizer) {
  return normalizer.getText(row, ["Adi", "Adı"]);
}

function getStoreName(row: ExportRow, normalizer: PowerBiReconciliationNormalizer) {
  return normalizer.getText(row, ["MagazaAdi", "Magaza Adi", "Mağaza Adı"]);
}

function getStoreNetSales(row: ExportRow, normalizer: PowerBiReconciliationNormalizer) {
  return normalizer.getNumber(row, ["Ciro"]);
}

function getPersonnelSalesAmount(
  row: ExportRow,
  normalizer: PowerBiReconciliationNormalizer,
) {
  return normalizer.getNumber(row, ["SatisTutari", "Satış Tutarı"]);
}

function isSummaryText(value: string, normalizer: PowerBiReconciliationNormalizer) {
  const normalized = normalizer.normalizeKey(value);
  return normalized === "total" || normalized.startsWith("uygulananfiltreler");
}

function isStoreInKpiImportScope(
  storeName: string,
  storeScope: PowerBiReconciliationStoreScope,
  normalizer: PowerBiReconciliationNormalizer,
) {
  return storeScope.externalRefKeys.has(normalizer.normalizeKey(storeName));
}
