import * as XLSX from "@e965/xlsx";
import {
  buildPersonnelMasterWorkbook,
  sortPersonnelMasterExportItems,
  type PersonnelMasterExportItem,
} from "./personnel-master-export";

const base: PersonnelMasterExportItem = {
  displayName: "Bora Yılmaz",
  externalEmployeeRef: "P-002",
  nationalIdLast4: "1234",
  phoneNumber: "+905321234567",
  hireDate: "2026-01-05",
  terminationDate: null,
  employmentStatus: "active",
  employmentType: "full_time",
  storeCode: "IST-001",
  storeName: "İstanbul Kadıköy",
  positionName: "Mağaza Müdürü",
};

describe("personnel master export", () => {
  it("sorts every status into one deterministic list", () => {
    const sorted = sortPersonnelMasterExportItems([
      { ...base, displayName: "Cem Kaya", employmentStatus: "terminated" },
      { ...base, displayName: "Zeynep Ak", employmentStatus: "active" },
      { ...base, displayName: "Ayşe Demir", employmentStatus: "active" },
      { ...base, displayName: "Deniz Acar", employmentStatus: "inactive" },
    ]);

    expect(sorted.map((item) => `${item.employmentStatus}:${item.displayName}`)).toEqual([
      "active:Ayşe Demir",
      "active:Zeynep Ak",
      "inactive:Deniz Acar",
      "terminated:Cem Kaya",
    ]);
  });

  it("creates a readable xlsx without exposing a full national id", () => {
    const workbook = XLSX.read(buildPersonnelMasterWorkbook([base]), { type: "buffer" });
    const sheet = workbook.Sheets.Personel;
    const rows = XLSX.utils.sheet_to_json<Array<string>>(sheet, { header: 1 });

    expect(rows[0]).toEqual([
      "Durum",
      "Ad Soyad",
      "Sicil Numarası",
      "T.C. Kimlik Numarası",
      "Telefon Numarası",
      "Mağaza",
      "Mağaza Kodu",
      "Pozisyon",
      "İşe Giriş Tarihi",
      "İşten Çıkış Tarihi",
      "Çalışma Tipi",
    ]);
    expect(rows[1]).toEqual([
      "Aktif",
      "Bora Yılmaz",
      "P-002",
      "*******1234",
      "+905321234567",
      "İstanbul Kadıköy",
      "IST-001",
      "Mağaza Müdürü",
      "2026-01-05",
      "",
      "Tam zamanlı",
    ]);
  });
});
