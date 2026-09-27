/** Cliente Transbank Webpay Plus REST (integración / producción). */

export type TbkEnv = "integration" | "production";

export function tbkConfig() {
  const rawEnv = (
    Deno.env.get("WEBPAY_ENV") ||
    Deno.env.get("TBK_ENV") ||
    "integration"
  ).toLowerCase();
  const env: TbkEnv = rawEnv === "production" ? "production" : "integration";
  const isProd = env === "production";
  const commerceCode = (
    Deno.env.get("WEBPAY_COMMERCE_CODE") ||
    Deno.env.get("TBK_COMMERCE_CODE") ||
    ""
  ).trim();
  const apiKey = (
    Deno.env.get("WEBPAY_API_KEY") ||
    Deno.env.get("TBK_API_KEY") ||
    ""
  ).trim();
  const host = isProd
    ? "https://webpay3g.transbank.cl"
    : "https://webpay3gint.transbank.cl";

  if (!commerceCode || !apiKey) {
    throw new Error(
      "WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY son obligatorios (alias: TBK_COMMERCE_CODE / TBK_API_KEY). No hay credenciales en el código.",
    );
  }

  return { env, commerceCode, apiKey, host };
}

export async function tbkCreateTransaction(input: {
  buyOrder: string;
  sessionId: string;
  amount: number;
  returnUrl: string;
}): Promise<{ token: string; url: string }> {
  const { commerceCode, apiKey, host } = tbkConfig();
  const res = await fetch(
    `${host}/rswebpaytransaction/api/webpay/v1.2/transactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Tbk-Api-Key-Id": commerceCode,
        "Tbk-Api-Key-Secret": apiKey,
      },
      body: JSON.stringify({
        buy_order: input.buyOrder.slice(0, 26),
        session_id: input.sessionId.slice(0, 61),
        amount: Math.round(input.amount),
        return_url: input.returnUrl,
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data === "object"
        ? JSON.stringify(data)
        : `TBK create failed ${res.status}`,
    );
  }
  return { token: data.token, url: data.url };
}

export async function tbkCommit(token: string): Promise<Record<string, unknown>> {
  const { commerceCode, apiKey, host } = tbkConfig();
  const res = await fetch(
    `${host}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Tbk-Api-Key-Id": commerceCode,
        "Tbk-Api-Key-Secret": apiKey,
      },
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data === "object"
        ? JSON.stringify(data)
        : `TBK commit failed ${res.status}`,
    );
  }
  return data as Record<string, unknown>;
}

/** Consulta de estado (reintento si el commit ya fue consumido). */
export async function tbkStatus(
  token: string,
): Promise<Record<string, unknown>> {
  const { commerceCode, apiKey, host } = tbkConfig();
  const res = await fetch(
    `${host}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Tbk-Api-Key-Id": commerceCode,
        "Tbk-Api-Key-Secret": apiKey,
      },
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data === "object"
        ? JSON.stringify(data)
        : `TBK status failed ${res.status}`,
    );
  }
  return data as Record<string, unknown>;
}

/** Anulación / reembolso Webpay Plus (monto en CLP). */
export async function tbkRefund(
  token: string,
  amount: number,
): Promise<Record<string, unknown>> {
  const { commerceCode, apiKey, host } = tbkConfig();
  const res = await fetch(
    `${host}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}/refunds`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Tbk-Api-Key-Id": commerceCode,
        "Tbk-Api-Key-Secret": apiKey,
      },
      body: JSON.stringify({ amount: Math.round(amount) }),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data === "object"
        ? JSON.stringify(data)
        : `TBK refund failed ${res.status}`,
    );
  }
  return data as Record<string, unknown>;
}
