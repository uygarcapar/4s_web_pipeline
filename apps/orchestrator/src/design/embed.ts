/**
 * Local image embeddings for the visual-distance gate (D10 §8.2).
 *
 * §8.2 says "DINOv2 (or CLIP) via a small local Python tool". This is
 * DINOv2, in Node, through `@huggingface/transformers` and ONNX Runtime
 * (operator decision, 2026-10-22): the guarantee §8.2 is actually making is
 * that embedding happens **locally** and no client render leaves the
 * machine (§13 Q4), and that holds either way. What changes is that the
 * pipeline keeps one toolchain instead of two, and nobody has to install
 * 2.5 GB of PyTorch against a Python the wheels may not cover.
 *
 * Model weights are fetched once from the Hugging Face CDN and cached under
 * the usual transformers cache. Client images are never uploaded — the only
 * network traffic is the model download, and only on a cold cache.
 */

/** DINOv2-small: 384 dims, 22M params, ~90 MB. */
export const MODEL = "Xenova/dinov2-small";

/** Length of the vector this module produces. */
export const EMBEDDING_DIMS = 384;

type Extractor = (
  image: unknown,
  options?: Record<string, unknown>,
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

let extractor: Promise<Extractor> | null = null;

/**
 * Load the model once per process.
 *
 * It costs ~9.5 s cold and the design stage embeds two images per candidate,
 * so paying that per call would dominate the stage. Cached as the promise
 * rather than the resolved value so two concurrent callers share one load.
 */
async function getExtractor(): Promise<Extractor> {
  if (extractor === null) {
    extractor = import("@huggingface/transformers").then(
      async ({ pipeline }) =>
        (await pipeline("image-feature-extraction", MODEL, {
          dtype: "fp32",
        })) as unknown as Extractor,
    );
  }
  return extractor;
}

/**
 * Embed one screenshot as an L2-normalised vector.
 *
 * The model returns `[1, 257, 384]` — one CLS token plus 256 patch tokens —
 * and the pipeline's own `pooling: "mean"` option does not apply to it, so
 * the pooling is done here. Taking **token 0** rather than the mean is
 * DINOv2's own convention: the CLS token is trained to be the global image
 * descriptor, while the mean over patches flattens out exactly the
 * composition differences this gate is looking for. Two pages with the same
 * palette and different layouts mean-pool to nearly the same vector.
 *
 * Normalised so the caller's cosine similarity is a dot product, and so a
 * vector stays comparable to one embedded by an earlier version of this
 * code as long as the model is the same.
 */
export async function embedImage(path: string): Promise<Float32Array> {
  const { RawImage } = await import("@huggingface/transformers");
  const run = await getExtractor();
  const image = await RawImage.read(path);
  const out = await run(image, { pooling: "none" });

  const [, tokens, dims] = out.dims as [number, number, number];
  if (dims !== EMBEDDING_DIMS) {
    throw new Error(
      `${MODEL} produced ${dims} dims, expected ${EMBEDDING_DIMS} — ` +
        "stored vectors are not comparable across models, so this is a " +
        "stop rather than a coercion",
    );
  }
  void tokens;

  const data = out.data;
  const cls = new Float32Array(dims);
  for (let i = 0; i < dims; i += 1) cls[i] = Number(data[i]);
  return normalise(cls);
}

/** Both folds of one candidate, in a fixed order. */
export async function embedShots(shots: {
  desktop: string;
  mobile: string;
}): Promise<{ desktop: Float32Array; mobile: Float32Array }> {
  return {
    desktop: await embedImage(shots.desktop),
    mobile: await embedImage(shots.mobile),
  };
}

export function normalise(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const length = Math.sqrt(sum);
  // A zero vector means a blank screenshot, which is a broken pre-render
  // rather than a site that looks like nothing. Left as-is so the
  // similarity comes out 0 and the candidate passes — a gate must not
  // reject on its own failure.
  if (length === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i += 1) out[i] = v[i]! / length;
  return out;
}

/** Cosine similarity of two normalised vectors: a dot product. */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`cannot compare ${a.length}-dim and ${b.length}-dim vectors`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i]! * b[i]!;
  return Number(sum.toFixed(6));
}

/** Pack a vector for the `vectors` table. */
export function packVector(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function unpackVector(blob: Buffer | Uint8Array): Float32Array {
  const bytes = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  // Copied rather than viewed: a Buffer from better-sqlite3 may sit at a
  // non-zero offset in a pooled allocation, and a Float32Array view over an
  // unaligned offset throws.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}
