import { createServer, Socket, type Server } from "node:net";
import { createServer as createHttpServer } from "node:http";

const OFFICE365_HOST = "smtp.office365.com";
const OFFICE365_PORT = 587;
const LISTEN_HOST = "172.30.10.40";
const LISTEN_PORT = 587;
const HEALTH_PORT = 1588;
const MAX_CONNECTIONS = 16;
const IDLE_TIMEOUT_MS = 120_000;

export function createSmtpEgressServer(options: {
  upstreamHost: string;
  upstreamPort: number;
  maxConnections?: number;
}): Server {
  let activeConnections = 0;
  const maxConnections = options.maxConnections ?? MAX_CONNECTIONS;

  return createServer((client: Socket) => {
    if (activeConnections >= maxConnections) {
      client.destroy();
      return;
    }

    activeConnections += 1;
    const upstream = new Socket();
    const closeBoth = () => {
      client.destroy();
      upstream.destroy();
    };

    client.setTimeout(IDLE_TIMEOUT_MS, closeBoth);
    upstream.setTimeout(IDLE_TIMEOUT_MS, closeBoth);
    client.once("close", () => {
      activeConnections -= 1;
      upstream.destroy();
    });
    upstream.once("close", () => client.destroy());
    client.on("error", closeBoth);
    upstream.on("error", closeBoth);

    upstream.connect({ host: options.upstreamHost, port: options.upstreamPort, family: 4 }, () => {
      client.pipe(upstream);
      upstream.pipe(client);
    });
  });
}

if (require.main === module) {
  const relay = createSmtpEgressServer({
    upstreamHost: OFFICE365_HOST,
    upstreamPort: OFFICE365_PORT,
  });
  const health = createHttpServer((request, response) => {
    response.writeHead(request.method === "GET" && request.url === "/healthz" ? 200 : 404);
    response.end();
  });

  relay.on("error", () => process.exit(1));
  health.on("error", () => process.exit(1));
  relay.listen(LISTEN_PORT, LISTEN_HOST);
  health.listen(HEALTH_PORT, "127.0.0.1");

  process.on("SIGTERM", () => {
    relay.close();
    health.close();
  });
}
