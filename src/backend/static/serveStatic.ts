import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";
import { sendJson } from "../infra/http";

export async function sendStaticFile(response: ServerResponse, distDir: string, pathname: string): Promise<void> {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const staticPath = resolve(distDir, `.${decodeURIComponent(requestedPath)}`);
  const isInsideDist = staticPath === distDir || staticPath.startsWith(`${distDir}${sep}`);

  if (!isInsideDist) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const file = await readFile(staticPath);
    response.statusCode = 200;
    response.setHeader("Content-Type", getContentType(staticPath));
    response.end(file);
  } catch {
    try {
      const index = await readFile(join(distDir, "index.html"));
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(index);
    } catch {
      sendJson(response, 404, { error: "Frontend build not found. Run npm run build first." });
    }
  }
}

function getContentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}
