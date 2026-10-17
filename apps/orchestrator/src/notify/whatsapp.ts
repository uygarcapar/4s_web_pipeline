/**
 * WhatsApp Meta Cloud API sender. Target channel once the operator's
 * company passes Meta business verification (docs/DECISIONS.md D2/D3).
 * Tries the approved `site_ready` utility template first; falls back to a
 * free-form text (works only inside the operator's 24h session window).
 */
const GRAPH_BASE = "https://graph.facebook.com/v25.0";

async function post(
  phoneNumberId: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

export async function sendWhatsAppSiteReady(input: {
  token: string;
  phoneNumberId: string;
  to: string; // E.164 with +
  businessName: string;
  oldUrl: string;
  previewHint: string;
}): Promise<{ via: "template" | "text" }> {
  const templateRes = await post(input.phoneNumberId, input.token, {
    to: input.to,
    type: "template",
    template: {
      name: "site_ready",
      language: { code: "tr" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.businessName },
            { type: "text", text: input.oldUrl },
            { type: "text", text: input.previewHint },
          ],
        },
      ],
    },
  });
  if (templateRes.ok) return { via: "template" };

  const textRes = await post(input.phoneNumberId, input.token, {
    to: input.to,
    type: "text",
    text: {
      body: `${input.businessName} için yeni site hazır. Eski site: ${input.oldUrl} Önizleme: ${input.previewHint}`,
    },
  });
  if (textRes.ok) return { via: "text" };

  throw new Error(
    `WhatsApp API failed: template ${templateRes.status} ${templateRes.body.slice(0, 200)}; text ${textRes.status} ${textRes.body.slice(0, 200)}`,
  );
}
