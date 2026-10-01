/** Additive, detail-only financial values; summary masking remains in the read service. */
export const personnelRankingDetailProperties = {
  sales: {
    type: 'object', nullable: true, additionalProperties: false,
    required: ['grossSales', 'signedReturns', 'netSales'],
    properties: {
      grossSales: { type: 'string' },
      signedReturns: { type: 'string', nullable: true },
      netSales: { type: 'string', nullable: true },
    },
    description: 'Verified prim V2 gross, same-store attributed returns and net for the selected store/dates. Null when unavailable; omitted for summary rows.',
  },
  scoreValue: { type: 'number' },
  storeScoreShare: {
    type: 'number', nullable: true, minimum: 0, maximum: 1,
    description: 'Net sales × personnel KPI score share within the store before pagination. Null when allocation inputs are incomplete; omitted for summary rows. This is an allocation, not causal impact.',
  },
  canOpenProfile: { type: 'boolean' },
};
