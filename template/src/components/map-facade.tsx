"use client";

import { useState } from "react";

interface MapFacadeProps {
  embedUrl: string;
  title: string;
  address: string;
  className: string;
}

/**
 * Click-to-load facade for the Google Maps embed.
 *
 * Two reasons this is not a plain <iframe loading="lazy">: the embed pulls
 * ~470 KB of third-party JavaScript (Chrome's lazy threshold still fetches
 * it on slow connections, which pushed LCP past the gate), and it sets
 * Google cookies before the visitor has made a KVKK choice. The facade
 * renders the address as static HTML and only mounts the iframe after an
 * explicit click.
 */
export function MapFacade({ embedUrl, title, address, className }: MapFacadeProps) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        src={embedUrl}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={className}
      />
    );
  }

  return (
    <div
      className={`${className} flex flex-col items-center justify-center gap-3 bg-brand-50 px-6 text-center`}
    >
      <p className="text-sm text-foreground">{address}</p>
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Haritayı Göster
      </button>
      <p className="text-xs text-muted-foreground">
        Harita açıldığında Google tarafından çerez yerleştirilebilir.
      </p>
    </div>
  );
}
