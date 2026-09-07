import { createRequire } from "node:module";

// Exercise the actual parser selected by Nest's Express adapter, not a mock.
const adapterRequire = createRequire(require.resolve("@nestjs/platform-express/package.json"));
const expressRequire = createRequire(adapterRequire.resolve("express/package.json"));
const bodyParserRequire = createRequire(expressRequire.resolve("body-parser/package.json"));
const qs = expressRequire("qs") as {
  parse(value: string, options?: Record<string, unknown>): unknown;
  stringify(value: unknown): string;
};

describe("HTTP query/form parser security regressions", () => {
  it("uses the same patched parser for Express queries and body-parser forms", () => {
    expect(bodyParserRequire.resolve("qs")).toBe(expressRequire.resolve("qs"));
  });

  it("preserves ordinary nested filters, repeated values and Unicode", () => {
    const value = { filter: { store: "store-A" }, tag: ["one", "two"], label: "Mağaza" };
    expect(qs.parse(qs.stringify(value))).toEqual(value);
    expect(qs.parse("tag=one&tag=two")).toEqual({ tag: ["one", "two"] });
  });

  // GHSA-x5fp-wj9c-mxmx: bracket keys must not bypass comma-group limits.
  it.each(["a=1,2,3,4", "a[]=1,2,3,4"])("rejects oversized comma groups: %s", (value) => {
    expect(() => qs.parse(value, {
      comma: true,
      arrayLimit: 3,
      throwOnLimitExceeded: true,
    })).toThrow(RangeError);
  });

  // GHSA-4mjr-xmp4-gh2g: untrusted data must not become a function call.
  it.each([{ plainObjects: true }, { allowPrototypes: true }])(
    "serializes a non-callable constructor.isBuffer safely with %j",
    (options) => {
      const query = "x%5Bconstructor%5D%5BisBuffer%5D=not-a-function";
      const value = qs.parse(query, options);
      expect(qs.stringify(value)).toBe(query);
    },
  );
});
