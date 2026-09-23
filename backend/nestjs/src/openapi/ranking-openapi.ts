import { setQueryParameters } from "./openapi-schema-helpers";

const stringQuery = (name: string, description: string, extra: Record<string, unknown> = {}) => ({
  name,
  in: "query",
  required: false,
  description,
  schema: { type: "string", ...extra },
});

const integerQuery = (
  name: string,
  description: string,
  minimum: number,
  maximum?: number,
) => ({
  name,
  in: "query",
  required: false,
  description,
  schema: {
    type: "integer",
    minimum,
    ...(maximum === undefined ? {} : { maximum }),
  },
});

export function applyRankingOpenApi(paths: Record<string, unknown>) {
  setQueryParameters(paths, "/api/reports/rankings", "get", [
    stringQuery("periodType", "Ranking period type.", { enum: ["daily", "monthly"] }),
    stringQuery("periodStart", "ISO date identifying the requested period.", { format: "date" }),
    stringQuery("regionManagerUserId", "Optional Region Manager drill filter.", { format: "uuid" }),
    stringQuery("regionManagerSearch", "Search Region Managers by name before pagination."),
    stringQuery("regionId", "Optional region filter.", { format: "uuid" }),
    stringQuery("storeId", "Optional store filter.", { format: "uuid" }),
    stringQuery("search", "Optional store or personnel search text."),
    stringQuery("sortKey", "Ranking sort key.", {
      enum: ["score", "UPT", "ATV", "CR", "TARGET_ACHIEVEMENT", "BM_CHECKLIST", "VM_CHECKLIST", "gsm_approval"],
    }),
    stringQuery("sortDirection", "Ranking sort direction.", { enum: ["asc", "desc"] }),
    integerQuery("limit", "Bounded ranking page size.", 1, 500),
    integerQuery("offset", "Ranking page offset.", 0),
    integerQuery("regionManagerLimit", "Bounded Region Manager page size.", 1, 100),
    integerQuery("regionManagerOffset", "Region Manager page offset.", 0),
    integerQuery("regionManagerRiskOffset", "Risk Region Manager page offset.", 0),
    {
      name: "regionManagerUnassigned",
      in: "query",
      required: false,
      description: "Restrict the company drill to stores without a Region Manager.",
      schema: { type: "boolean" },
    },
    integerQuery("managedPersonnelLimit", "Bounded managed-store personnel page size.", 1, 100),
    integerQuery("managedPersonnelOffset", "Managed-store personnel page offset.", 0),
  ]);
}
