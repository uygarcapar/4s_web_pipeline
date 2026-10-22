import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";

/**
 * Serve a screenshot out of `runs/<domain>/…`.
 *
 * A route rather than a symlink into `public/`. The symlink worked and also
 * pulled every generated client site into this app's typecheck — `tsc`
 * followed it into `runs/<domain>/generate/src/**` and started reporting
 * errors in a stranger's generated code, including one from a run that
 * predates the `signature` section type.
 *
 * Path traversal is blocked by resolving against `runs/` and checking the
 * result is still under it: these are local review screenshots, but the
 * page is served on a port and the check costs one comparison.
 */
const RUNS = resolve(process.cwd(), "..", "..", "runs");

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const file = resolve(join(RUNS, normalize(path.join("/"))));

  if (!file.startsWith(RUNS + "/")) {
    return new Response("outside runs/", { status: 403 });
  }
  const ext = file.slice(file.lastIndexOf("."));
  if (!(ext in TYPES)) {
    return new Response("not an image", { status: 415 });
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    return new Response("not found", { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: { "content-type": TYPES[ext]!, "cache-control": "no-store" },
  });
}
