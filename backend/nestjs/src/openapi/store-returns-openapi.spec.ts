import { applyStoreReturnsOpenApi } from "./store-returns-openapi";
import { applySalesTargetIncentiveWorkspaceOpenApi } from "./sales-target-incentive-workspace-openapi";

describe("shared return ledger public contract",()=>{
  it("publishes nullable financial evidence, real identity and explicit coverage without exposing provider fields",()=>{
    const document={components:{schemas:{} as Record<string,unknown>},paths:{
      "/api/reports/store-returns":{get:{operationId:"StoreReturnsController_getLedger",responses:{}}},
      "/api/store/incentives/workspace":{get:{responses:{}}},
    }};
    applyStoreReturnsOpenApi(document);applySalesTargetIncentiveWorkspaceOpenApi(document);
    expect(document.components.schemas.StoreReturnsLedger).toMatchObject({properties:{
      totals:{properties:{netSales:{nullable:true},receivedSignedAmount:{nullable:true}}},
      coverage:{properties:{missingDates:{type:"array"},status:{enum:["complete","partial","no_data"]}}},
    }});
    expect(document.components.schemas.StoreReturnRow).toMatchObject({properties:{
      employeeId:{nullable:true},category:{enum:["in_store","out_of_norm","cross_store","review_required"]},
    }});
    expect(document.components.schemas.SalesTargetIncentiveWorkspaceStore).toMatchObject({properties:{
      positiveSellers:{items:{properties:{employeeId:{nullable:true},netAmount:{nullable:true}}}},
    }});
    expect(JSON.stringify(document)).not.toMatch(/Original[A-Z]|invoiceId|payload|password|token/);
    expect(document.paths["/api/reports/store-returns"].get.operationId).toBe("StoreReturnsController_getLedger");
  });
});
