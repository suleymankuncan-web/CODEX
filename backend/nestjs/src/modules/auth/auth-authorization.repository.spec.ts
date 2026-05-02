import { AuthAuthorizationRepository } from "./auth-authorization.repository";

describe("AuthAuthorizationRepository", () => {
  it("queries role assignments for deterministic seed UUIDs accepted by Postgres", async () => {
    const databaseService = {
      query: jest.fn(async () => ({ rows: [] })),
    };
    const repository = new AuthAuthorizationRepository(databaseService as never);

    await repository.getActiveRoleAssignments("80000000-0000-0000-0000-000000000900");

    expect(databaseService.query).toHaveBeenCalledTimes(1);
  });
});
