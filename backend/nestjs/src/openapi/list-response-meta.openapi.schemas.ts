export const listResponseMetaSchema = {
  type: "object",
  required: ["count", "total", "limit", "offset"],
  properties: {
    count: { type: "integer", minimum: 0 },
    total: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 0 },
    offset: { type: "integer", minimum: 0 },
  },
};

export const revisionedListResponseMetaSchema = {
  type: "object",
  required: ["count", "total", "limit", "offset", "revision"],
  properties: {
    ...listResponseMetaSchema.properties,
    revision: {
      type: "string",
      nullable: true,
      minLength: 64,
      maxLength: 64,
      pattern: "^[0-9a-f]{64}$",
    },
  },
};
