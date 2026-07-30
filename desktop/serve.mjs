import { createRaaviServer } from "./server.mjs";

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const host = argumentValue("--host", "127.0.0.1");
const requestedPort = Number(argumentValue("--port", "3000"));
const port =
  Number.isSafeInteger(requestedPort) &&
  requestedPort >= 0 &&
  requestedPort <= 65_535
    ? requestedPort
    : 3000;
const server = await createRaaviServer({ host, port });

console.log(`Raavi is available at ${server.origin}`);

async function close() {
  await server.close();
  process.exit(0);
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
