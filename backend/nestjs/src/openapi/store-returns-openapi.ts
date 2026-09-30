import { setJsonResponseSchema } from "./openapi-schema-helpers";

type Document = { components?: { schemas?: Record<string,unknown> }; paths: Record<string,unknown> };
const str={type:"string"};
const nullable={type:"string",nullable:true};
const date={type:"string",format:"date"};
const count={type:"integer",minimum:0};
const decimal={type:"string",pattern:"^-?\\d+(?:\\.\\d+)?$"};
const ref=(name:string)=>({$ref:`#/components/schemas/${name}`});
const object=(properties:Record<string,unknown>)=>({type:"object",required:Object.keys(properties),properties});

export function applyStoreReturnsOpenApi(document:Document) {
  document.components??={};
  document.components.schemas={...document.components.schemas,
    StoreReturnRow:object({
      returnId:{type:"string",format:"uuid"},businessDate:date,
      direction:{type:"string",enum:["received","external"]},
      category:{type:"string",enum:["in_store","out_of_norm","cross_store","review_required"]},
      personnelCode:nullable,employeeId:{type:"string",format:"uuid",nullable:true},displayName:nullable,
      receivingStoreCode:str,receivingStoreName:nullable,originalStoreCode:nullable,originalStoreName:nullable,
      signedAmount:decimal,invoiceCount:count,
    }),
    StoreReturnsLedger:object({
      storeId:{type:"string",format:"uuid"},periodStart:date,periodEnd:date,timezone:str,
      totals:object({receivedSignedAmount:{...decimal,nullable:true},receivedInvoiceCount:{...count,nullable:true},
        externalSignedAmount:decimal,netSales:{...decimal,nullable:true}}),
      coverage:object({expectedDays:count,coveredDays:count,missingDates:{type:"array",items:date},
        status:{type:"string",enum:["complete","partial","no_data"]},unresolvedRows:count}),
      rows:{type:"array",items:ref("StoreReturnRow")},page:object({total:count,limit:count,offset:count}),
    }),
    StoreReturnsLedgerResponse:object({data:ref("StoreReturnsLedger")}),
  };
  setJsonResponseSchema(document.paths,"/api/reports/store-returns","get",
    "Scoped daily return ledger with canonical received totals and explicit coverage.","StoreReturnsLedgerResponse");
}
