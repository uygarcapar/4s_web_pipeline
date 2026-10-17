import { isPreview } from "@/lib/seo";

/**
 * Visible draft banner rendered at the very top of every page when the
 * SITE_PREVIEW env var is set (preview deployments only).
 */
export function PreviewBanner() {
  if (!isPreview()) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950"
    >
      Taslak / Önizleme — resmi site değildir
    </div>
  );
}
