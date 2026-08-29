import * as XLSX from "@e965/xlsx";

export type PersonnelMasterExportItem = {
  displayName: string;
  externalEmployeeRef: string | null;
  nationalIdLast4: string | null;
  phoneNumber: string | null;
  hireDate: string;
  terminationDate: string | null;
  employmentStatus: string;
  employmentType: string;
  storeCode: string | null;
  storeName: string | null;
  positionName: string | null;
};

const headers = [
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
];

const statusOrder = new Map([
  ["active", 0],
  ["inactive", 1],
  ["terminated", 2],
]);

export function sortPersonnelMasterExportItems(items: PersonnelMasterExportItem[]) {
  return [...items].sort((left, right) => {
    const statusDifference = (statusOrder.get(left.employmentStatus) ?? 99) - (statusOrder.get(right.employmentStatus) ?? 99);
    return statusDifference || left.displayName.localeCompare(right.displayName, "tr-TR");
  });
}

export function buildPersonnelMasterWorkbook(items: PersonnelMasterExportItem[]) {
  const sorted = sortPersonnelMasterExportItems(items);
  const rows = [
    headers,
    ...sorted.map((item) => [
      employmentStatusLabel(item.employmentStatus),
      item.displayName,
      item.externalEmployeeRef ?? "",
      item.nationalIdLast4 ? `*******${item.nationalIdLast4}` : "",
      item.phoneNumber ?? "",
      item.storeName ?? "",
      item.storeCode ?? "",
      item.positionName ?? "",
      item.hireDate,
      item.terminationDate ?? "",
      employmentTypeLabel(item.employmentType),
    ]),
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = headers.map((header, columnIndex) => ({
    wch: Math.max(header.length + 4, ...rows.slice(1).map((row) => String(row[columnIndex] ?? "").length + 2), 12),
  }));
  worksheet["!autofilter"] = { ref: `A1:K${Math.max(rows.length, 1)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, worksheet, "Personel");

  return Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
}

function employmentStatusLabel(status: string) {
  if (status === "active") return "Aktif";
  if (status === "inactive") return "Pasif";
  if (status === "terminated") return "İşten çıktı";
  return status;
}

function employmentTypeLabel(type: string) {
  if (type === "full_time") return "Tam zamanlı";
  if (type === "part_time") return "Yarı zamanlı";
  if (type === "contractor") return "Sözleşmeli";
  return type;
}
