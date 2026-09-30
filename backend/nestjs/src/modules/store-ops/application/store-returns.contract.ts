export type StoreReturnCategory = "in_store" | "out_of_norm" | "cross_store" | "review_required";

// Rows are daily groups. Invoice counts across groups must not be added.
export type StoreReturnRow = {
  returnId: string;
  businessDate: string;
  direction: "received" | "external";
  category: StoreReturnCategory;
  personnelCode: string | null;
  employeeId: string | null;
  displayName: string | null;
  receivingStoreCode: string;
  receivingStoreName: string | null;
  originalStoreCode: string | null;
  originalStoreName: string | null;
  signedAmount: string;
  invoiceCount: number;
};

export type StoreReturnsLedger = {
  storeId: string;
  periodStart: string;
  periodEnd: string;
  timezone: "Europe/Istanbul";
  totals: {
    receivedSignedAmount: string | null;
    receivedInvoiceCount: number | null;
    externalSignedAmount: string;
    netSales: string | null;
  };
  coverage: {
    expectedDays: number;
    coveredDays: number;
    missingDates: string[];
    status: "complete" | "partial" | "no_data";
    unresolvedRows: number;
  };
  rows: StoreReturnRow[];
  page: { total: number; limit: number; offset: number };
};

export type StorePositiveSeller = {
  store_id: string;
  employee_id: string | null;
  personnel_code: string | null;
  display_name: string | null;
  position_code: string | null;
  current_employment_status: "active" | "inactive" | "terminated" | null;
  termination_date: string | null;
  sale_amount: string;
  return_amount: string | null;
  net_amount: string | null;
  last_positive_date: string;
  covered_days: number;
  no_positive_sales_15_days: boolean;
};
