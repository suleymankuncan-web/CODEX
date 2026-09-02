import { Module } from "@nestjs/common";
import { ChecklistResultPdfRenderer } from "./application/checklist-result-pdf.renderer";
import { ChecklistResultPdfService } from "./application/checklist-result-pdf.service";
import { ChecklistResultPdfController } from "./web/checklist-result-pdf.controller";
import { StoreOpsChecklistModule } from "./store-ops-checklist.module";

@Module({
  imports: [StoreOpsChecklistModule],
  controllers: [ChecklistResultPdfController],
  providers: [ChecklistResultPdfRenderer, ChecklistResultPdfService],
})
export class StoreOpsChecklistResultPdfModule {}
