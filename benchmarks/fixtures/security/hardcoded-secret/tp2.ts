import axios from "axios";

const API_KEY = "sk_live_abc123def456ghi789";
const WEBHOOK_SECRET = "whsec_MIGfMA0GCSqGSIb3DQEBA";

export async function fetchPaymentStatus(paymentId: string) {
  const response = await axios.get(
    `https://api.stripe.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

export function verifyWebhook(payload: string, signature: string): boolean {
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  return signature === expected;
}
