/** Telegram Bot API sender. Interim channel per docs/DECISIONS.md D3. */
export async function sendTelegram(input: {
  token: string;
  chatId: string;
  text: string;
}): Promise<{ messageId: number }> {
  const res = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: input.chatId, text: input.text }),
  });
  const body = (await res.json()) as {
    ok: boolean;
    result?: { message_id: number };
    description?: string;
  };
  if (!body.ok || !body.result) {
    throw new Error(`Telegram API error: ${body.description ?? res.status}`);
  }
  return { messageId: body.result.message_id };
}
