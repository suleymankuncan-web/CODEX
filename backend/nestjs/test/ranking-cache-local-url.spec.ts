import { Client } from "pg";
import IORedis from "ioredis";
import { localRankingCacheUrl } from "../scripts/ranking-cache-local-url";

const postgresProtocols = ["postgres:", "postgresql:"];

it.each([
  "postgres://127.0.0.1/postgres?host=outside.example",
  "postgres://localhost/postgres?%68ost=outside.example",
  "postgres://127.0.0.1/postgres?host=127.0.0.1&host=outside.example",
  "postgres://127.0.0.1/postgres?port=5432",
  "postgres://127.0.0.1/postgres#fragment",
  "postgres://outside.example/postgres",
  "https://127.0.0.1/postgres",
  "not-a-url",
])("rejects untrusted fixture connection options before driver construction: %s", value => {
  expect(() => localRankingCacheUrl("LOCAL_PROOF_URL", value, postgresProtocols)).toThrow();
});

it("rejects Redis query overrides as well", () => {
  expect(() => localRankingCacheUrl("LOCAL_PROOF_URL", "redis://127.0.0.1?host=outside.example", ["redis:"])).toThrow();
});

it("passes valid explicit loopback endpoints unchanged to the actual drivers without connecting", () => {
  const pgUrl = localRankingCacheUrl("LOCAL_PROOF_URL", "postgresql://fixture:local%3Fonly@127.0.0.1:54341/postgres", postgresProtocols);
  const client = new Client({ connectionString: pgUrl.toString() });
  expect(client.host).toBe("127.0.0.1");
  expect(client.port).toBe(54341);
  const redisUrl = localRankingCacheUrl("LOCAL_PROOF_URL", "redis://127.0.0.1:6387/0", ["redis:"]);
  const redis = new IORedis(redisUrl.toString(), { lazyConnect: true });
  expect(redis.options.host).toBe("127.0.0.1");
  expect(redis.options.port).toBe(6387);
  redis.disconnect();
});
