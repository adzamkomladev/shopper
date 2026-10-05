import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const directory = process.env.CAPTURE_DIR ?? "/captures";
await mkdir(directory, { recursive: true });
createServer((socket) => {
  const chunks = [];
  socket.on("data", (chunk) => chunks.push(chunk));
  socket.on("error", (error) => console.error(error.message));
  socket.on("end", async () => {
    try {
      await writeFile(`${directory}/${randomUUID()}.bin`, Buffer.concat(chunks));
    } catch (error) {
      console.error(error);
    }
  });
}).listen(Number(process.env.PORT ?? 9100), "0.0.0.0");
