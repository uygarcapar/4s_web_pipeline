"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/**
 * KVKK / cookie consent banner.
 *
 * The template ships with NO analytics or marketing scripts at all; consent
 * is recorded (localStorage + cookie) only so a future stage can gate such
 * scripts on it. Three equally-styled choices are offered, and no optional
 * purpose is pre-checked, as required for freely given consent.
 */

const STORAGE_KEY = "kvkk-consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 6 months

interface ConsentState {
  /** Strictly necessary storage — always on, not toggleable. */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

function persistConsent(consent: ConsentState) {
  const serialized = JSON.stringify(consent);
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Storage may be unavailable (private mode); the cookie still records it.
  }
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(
    serialized,
  )}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function hasStoredConsent(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return document.cookie.includes(`${STORAGE_KEY}=`);
  }
}

const CONSENT_CHANGE_EVENT = "kvkk-consent-change";

function subscribeToConsent(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CONSENT_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CONSENT_CHANGE_EVENT, callback);
  };
}

export function ConsentBanner() {
  // External-store read: hidden during SSR/hydration (server snapshot) and
  // whenever a decision is already stored on the client.
  const visible = useSyncExternalStore(
    subscribeToConsent,
    () => !hasStoredConsent(),
    () => false,
  );
  const [showPreferences, setShowPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  if (!visible) {
    return null;
  }

  const decide = (analyticsChoice: boolean, marketingChoice: boolean) => {
    persistConsent({
      necessary: true,
      analytics: analyticsChoice,
      marketing: marketingChoice,
      decidedAt: new Date().toISOString(),
    });
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  };

  return (
    <div
      role="region"
      aria-label="Çerez ve kişisel veri tercihleri"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <p className="text-sm text-foreground">
          Bu sitede yalnızca zorunlu çerezler kullanılır; analitik veya
          pazarlama amaçlı hiçbir izleme yapılmaz. Tercihleriniz, ileride
          eklenebilecek hizmetler için kaydedilir. Ayrıntılar için{" "}
          <a href="/cerez-politikasi" className="underline underline-offset-4">
            Çerez Politikası
          </a>{" "}
          ve{" "}
          <a href="/kvkk-aydinlatma" className="underline underline-offset-4">
            KVKK Aydınlatma Metni
          </a>
          ni inceleyebilirsiniz.
        </p>
        {showPreferences && (
          <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-semibold">
              Amaç bazlı tercihler
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked disabled />
              Zorunlu çerezler (her zaman etkin)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
              />
              Analitik çerezler
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
              />
              Pazarlama çerezleri
            </label>
          </fieldset>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => decide(true, true)}>
            Tümünü Kabul Et
          </Button>
          <Button variant="outline" onClick={() => decide(false, false)}>
            Tümünü Reddet
          </Button>
          {showPreferences ? (
            <Button
              variant="outline"
              onClick={() => decide(analytics, marketing)}
            >
              Tercihleri Kaydet
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setShowPreferences(true)}>
              Tercihleri Yönet
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
