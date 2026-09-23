import { once } from "node:events";
import { createConnection, createServer, type Server } from "node:net";
import { createSmtpEgressServer } from "./smtp-egress-proxy";

async function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TCP listener has no port");
  return address.port;
}

test("SMTP egress relay passes the greeting and STARTTLS command unchanged", async () => {
  const upstream = createServer((socket) => {
    socket.write("220 synthetic SMTP\r\n");
    socket.on("data", (data: Buffer) => {
      if (data.toString() === "STARTTLS\r\n") socket.write("220 Ready to start TLS\r\n");
    });
  });
  const upstreamPort = await listen(upstream);
  const relay = createSmtpEgressServer({ upstreamHost: "127.0.0.1", upstreamPort });
  const relayPort = await listen(relay);
  const client = createConnection(relayPort, "127.0.0.1");

  try {
    const [banner] = await once(client, "data");
    expect((banner as Buffer).toString()).toBe("220 synthetic SMTP\r\n");
    client.write("STARTTLS\r\n");
    const [reply] = await once(client, "data");
    expect((reply as Buffer).toString()).toBe("220 Ready to start TLS\r\n");
  } finally {
    client.destroy();
    relay.close();
    upstream.close();
  }
});
