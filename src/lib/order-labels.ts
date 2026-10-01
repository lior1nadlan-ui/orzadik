// Hebrew labels for orders.payment_status — ONE table for every CRM screen.
// It used to be copied into three routes, two of which lacked pending_charge
// (a status the CardCom webhook writes), so the dashboard and the customer
// card printed the raw English token for it.
export const PAYMENT_STATUS_HE: Record<string, string> = {
  paid: "שולם",
  unpaid: "לא שולם",
  failed: "תשלום נכשל",
  refunded: "זוכה",
  pending_charge: "ממתין לחיוב",
};

export function paymentStatusHe(s: string | null | undefined): string {
  const k = String(s ?? "");
  return PAYMENT_STATUS_HE[k] ?? k;
}
