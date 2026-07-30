import { Inject, Injectable } from "@nestjs/common";
import { JobDispatcher } from "../../../shared/jobs/job-dispatcher.interface";
import { JOB_DISPATCHER } from "../../../shared/jobs/jobs.constants";
import {
  VISUAL_COMPARISON_SHADOW_JOB_TYPE,
  VisualComparisonShadowRepositoryPort,
  VisualComparisonShadowRuntime,
} from "./visual-comparison-shadow.contract";
import {
  VISUAL_COMPARISON_SHADOW_REPOSITORY,
  VISUAL_COMPARISON_SHADOW_RUNTIME,
  VisualComparisonShadowService,
} from "./visual-comparison-shadow.service";
import {
  VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
  VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
} from "./visual-comparison.contract";

@Injectable()
export class VisualComparisonShadowReconcilerService {
  constructor(
    @Inject(VISUAL_COMPARISON_SHADOW_REPOSITORY)
    private readonly repository: VisualComparisonShadowRepositoryPort,
    @Inject(JOB_DISPATCHER)
    private readonly dispatcher: JobDispatcher,
    private readonly processor: VisualComparisonShadowService,
    @Inject(VISUAL_COMPARISON_SHADOW_RUNTIME)
    private readonly runtime: VisualComparisonShadowRuntime,
  ) {}

  async reconcile() {
    if (!this.runtime.enqueueEnabled) {
      return { status: "disabled" as const, dispatched: 0 };
    }
    const runIds = await this.repository.reconcile({
      ...this.runtime.scope,
      isolationClass: this.runtime.isolationClass,
      promptVersion: VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
      policyVersion: VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
      maxAttempts: this.runtime.maxAttempts,
      processingLeaseSeconds: this.runtime.processingLeaseSeconds,
    });
    for (const comparisonRunId of runIds) {
      await this.dispatcher.dispatch(
        VISUAL_COMPARISON_SHADOW_JOB_TYPE,
        { comparisonRunId },
        async (payload) => {
          await this.processor.process(payload);
        },
        { jobId: comparisonRunId },
      );
    }
    return { status: "queued" as const, dispatched: runIds.length };
  }
}
