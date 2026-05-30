import { buildPowerBiReconciliationSummary } from "./power-bi-reconciliation.builder";
import { PowerBiExportNormalizerService } from "./power-bi-export-normalizer.service";

function createScope(storeNames: string[], normalizer: PowerBiExportNormalizerService) {
  return {
    externalRefKeys: new Set(storeNames.map((storeName) => normalizer.normalizeKey(storeName))),
  };
}

describe("buildPowerBiReconciliationSummary", () => {
  it("keeps the existing balanced reconciliation shape", () => {
    const normalizer = new PowerBiExportNormalizerService();
    const storeScope = createScope(["Istanbul Marmara Park Avm"], normalizer);

    const summary = buildPowerBiReconciliationSummary({
      normalizer,
      storeScope,
      storeRows: [
        {
          MagazaAdi: "Istanbul Marmara Park Avm",
          Ciro: 7765681.31,
        },
      ],
      personnelRows: [
        {
          Adi: "Ali Can",
          MagazaAdi: "Istanbul Marmara Park Avm",
          SatisTutari: 7999351.19,
        },
        {
          Adi: "Ali Can",
          MagazaAdi: "Istanbul Marmara Park Avm",
          SatisTutari: -200000,
        },
        {
          Adi: "E-Store",
          MagazaAdi: "Istanbul Marmara Park Avm",
          SatisTutari: -33669.88,
        },
      ],
    });

    expect(summary).toEqual({
      comparedStoreCount: 1,
      balancedStoreCount: 1,
      warningStoreCount: 0,
      items: [
        {
          storeExternalRef: "Istanbul Marmara Park Avm",
          storeNetSales: 7765681.31,
          personnelPositiveSales: 7999351.19,
          personnelNegativeMovements: -233669.88,
          personnelNetMovement: 7765681.31,
          reconciliationDelta: 0,
          status: "balanced",
        },
      ],
    });
  });

  it("reports warnings and ignores rows outside the scoped store set", () => {
    const normalizer = new PowerBiExportNormalizerService();
    const storeScope = createScope(["Kadikoy"], normalizer);

    const summary = buildPowerBiReconciliationSummary({
      normalizer,
      storeScope,
      storeRows: [
        {
          MagazaAdi: "Kadikoy",
          Ciro: 1200,
        },
        {
          MagazaAdi: "Out Of Scope",
          Ciro: 9999,
        },
      ],
      personnelRows: [
        {
          Adi: "Ayse Yilmaz",
          MagazaAdi: "Kadikoy",
          SatisTutari: 1000,
        },
        {
          Adi: "Uygulanan Filtreler",
          MagazaAdi: "Kadikoy",
          SatisTutari: 200,
        },
        {
          Adi: "Ayse Yilmaz",
          MagazaAdi: "Out Of Scope",
          SatisTutari: 9999,
        },
      ],
    });

    expect(summary).toEqual({
      comparedStoreCount: 1,
      balancedStoreCount: 0,
      warningStoreCount: 1,
      items: [
        {
          storeExternalRef: "Kadikoy",
          storeNetSales: 1200,
          personnelPositiveSales: 1000,
          personnelNegativeMovements: 0,
          personnelNetMovement: 1000,
          reconciliationDelta: 200,
          status: "warning",
        },
      ],
    });
  });
});
