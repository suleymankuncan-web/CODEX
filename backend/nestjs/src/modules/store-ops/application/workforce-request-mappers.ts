export type WorkforceSellerCodeRequestRow = {
  seller_code_request_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  store_type: string;
  request_type: string;
  request_status: string;
  first_name: string;
  last_name: string;
  national_id_last4: string;
  phone_number: string;
  requested_hire_date: string;
  requested_position_id: string;
  position_code: string;
  position_name: string;
  employment_type: string;
  requested_seller_code: string | null;
  approved_seller_code: string | null;
  last_reference_seller_code: string | null;
  submitted_by_user_id: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  employee_id?: string | null;
};

export type WorkforceOffboardingRequestRow = {
  offboarding_request_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  employee_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  position_code: string | null;
  position_name: string | null;
  request_status: string;
  requested_termination_date: string;
  termination_reason: string;
  request_reason: string | null;
  submitted_by_user_id: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export function mapSellerCodeRequest(row: WorkforceSellerCodeRequestRow) {
  return {
    requestId: row.seller_code_request_id,
    companyId: row.company_id,
    regionId: row.region_id,
    storeId: row.store_id,
    storeCode: row.store_code,
    storeName: row.store_name,
    storeType: row.store_type,
    requestType: row.request_type,
    status: row.request_status,
    firstName: row.first_name,
    lastName: row.last_name,
    nationalIdLast4: row.national_id_last4,
    phoneNumber: row.phone_number,
    hireDate: row.requested_hire_date,
    requestedPositionId: row.requested_position_id,
    positionCode: row.position_code,
    positionName: row.position_name,
    employmentType: row.employment_type,
    requestedSellerCode: row.requested_seller_code,
    approvedSellerCode: row.approved_seller_code,
    lastReferenceSellerCode: row.last_reference_seller_code,
    submittedByUserId: row.submitted_by_user_id,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    employeeId: row.employee_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOffboardingRequest(row: WorkforceOffboardingRequestRow) {
  return {
    requestId: row.offboarding_request_id,
    companyId: row.company_id,
    regionId: row.region_id,
    storeId: row.store_id,
    storeCode: row.store_code,
    storeName: row.store_name,
    employeeId: row.employee_id,
    displayName: `${row.first_name} ${row.last_name}`.trim(),
    externalEmployeeRef: row.external_employee_ref,
    positionCode: row.position_code,
    positionName: row.position_name,
    status: row.request_status,
    terminationDate: row.requested_termination_date,
    terminationReason: row.termination_reason,
    requestReason: row.request_reason,
    submittedByUserId: row.submitted_by_user_id,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
