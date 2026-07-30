import { Module } from "@nestjs/common";
import { AppConfigModule } from "./shared/app-config.module";
import { AppConfigService } from "./shared/app-config.service";
import { DatabaseModule } from "./shared/database/database.module";
import { StoreOpsPhotoMediaModule } from "./modules/store-ops/store-ops-photo-media.module";
import { VisualComparisonShadowRepository } from "./modules/store-ops/infrastructure/visual-comparison-shadow.repository";
import {
  VisualComparisonShadowService,
  VISUAL_COMPARISON_PROVIDER,
  VISUAL_COMPARISON_SHADOW_REPOSITORY,
  VISUAL_COMPARISON_SHADOW_RUNTIME,
} from "./modules/store-ops/application/visual-comparison-shadow.service";
import { VisualComparisonShadowReconcilerService } from "./modules/store-ops/application/visual-comparison-shadow-reconciler.service";
import {
  FetchQwenVisualComparisonTransport,
  QwenVisualComparisonAdapter,
  QwenVisualComparisonConfiguration,
} from "./modules/store-ops/infrastructure/qwen-visual-comparison.adapter";

@Module({
  imports: [AppConfigModule, DatabaseModule, StoreOpsPhotoMediaModule],
  providers: [
    VisualComparisonShadowRepository,
    VisualComparisonShadowService,
    VisualComparisonShadowReconcilerService,
    {
      provide: VISUAL_COMPARISON_SHADOW_REPOSITORY,
      useExisting: VisualComparisonShadowRepository,
    },
    {
      provide: VISUAL_COMPARISON_SHADOW_RUNTIME,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const qwen = config.qwenVisualComparisonRuntimeConfiguration;
        const reservedSpendUsdMicrosPerAttempt = Math.ceil(
          (qwen.maxTokensPerRequest * Math.max(
            qwen.inputUsdMicrosPerMillionTokens,
            qwen.outputUsdMicrosPerMillionTokens,
          )) / 1_000_000,
        );
        return {
          enqueueEnabled: config.visualComparisonEnqueueEnabled,
          isolationClass: config.visualComparisonIsolationClass,
          workerEnabled: config.visualComparisonWorkerEnabled,
          maxAttempts: config.visualComparisonMaxAttempts,
          processingLeaseSeconds: config.visualComparisonProcessingLeaseSeconds,
          budget: {
            maxRequests: qwen.maxRequests,
            maxTotalTokens: qwen.maxTotalTokens,
            maxSpendUsdMicros: qwen.maxSpendUsdMicros,
            reservedTokensPerAttempt: qwen.maxTokensPerRequest,
            reservedSpendUsdMicrosPerAttempt,
          },
          scope: {
            companyId: config.visualComparisonCompanyId,
            referenceSetId: config.visualComparisonReferenceSetId,
            notBefore: config.visualComparisonNotBefore,
            limit: config.visualComparisonReconcileLimit,
          },
        };
      },
    },
    {
      provide: VISUAL_COMPARISON_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new QwenVisualComparisonAdapter(
          config.qwenVisualComparisonRuntimeConfiguration as QwenVisualComparisonConfiguration,
          new FetchQwenVisualComparisonTransport(),
        ),
    },
  ],
  exports: [VisualComparisonShadowService, VisualComparisonShadowReconcilerService],
})
export class WorkerVisualComparisonJobsModule {}
