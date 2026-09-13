import { assertDepartureTargets } from "./target-departure-contract";
describe("departed personnel target protection", () => {
  it("allows only recorded sales, including an omitted zero-sales allocation", () => {
    expect(() => assertDepartureTargets([{employee_id:"a",actual_sales:"300"}], [{employeeId:"a",targetValue:300}])).not.toThrow();
    expect(() => assertDepartureTargets([{employee_id:"a",actual_sales:"0"}], [])).not.toThrow();
  });
  it.each([null, "-1", "301"])("rejects missing, negative or mismatched sales %s", sales => {
    expect(() => assertDepartureTargets([{employee_id:"a",actual_sales:sales}], [{employeeId:"a",targetValue:300}])).toThrow();
  });
  it("rejects removal of a departed employee who has sales", () => {
    expect(() => assertDepartureTargets([{employee_id:"a",actual_sales:"300"}], [])).toThrow();
  });
});
