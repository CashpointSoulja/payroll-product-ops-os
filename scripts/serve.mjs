// Local preview: runs the built worker's fetch handler on Node's HTTP server.
import { createServer } from "node:http";
import worker from "../dist/worker.js";

const port = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  const response = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method }));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(req.method === "HEAD" ? undefined : Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`http://localhost:${port}`));
