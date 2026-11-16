// "חבר מביא חבר" on a paid order's page (rules in src/lib/referral.ts): the
// customer's own code to share, a one-tap WhatsApp share, and their choice to
// get the thank-you coupon by email. Renders nothing while the program is off,
// for an unpaid order, or if anything fails — it is a bonus on a page whose
// job is to confirm the order.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getOrderReferral, setReferralNotify, type OrderReferral } from "@/lib/referral.functions";

export function ReferralShareBox({ orderId }: { orderId: string }) {
  const load = useServerFn(getOrderReferral);
  const saveNotify = useServerFn(setReferralNotify);
  const qc = useQueryClient();
  const queryKey = ["order-referral", orderId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => load({ data: { orderId } }),
    staleTime: 5 * 60_000,
  });
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!data) return null;

  const waHref = `https://wa.me/?text=${encodeURIComponent(data.shareText)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("לא הצלחנו להעתיק. אפשר לסמן את הקוד ולהעתיק ידנית.");
    }
  };
  const onNotify = async (notify: boolean) => {
    setSaving(true);
    try {
      await saveNotify({ data: { orderId, notify } });
      qc.setQueryData(queryKey, (prev: OrderReferral | null | undefined) =>
        prev ? { ...prev, notify } : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "לא ניתן לשמור את הבחירה כרגע.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="referral-h" className="glass mt-6 p-6">
      <h2 id="referral-h" className="mb-2 flex items-center gap-2 font-display text-xl font-bold">
        <Gift className="h-5 w-5 text-accent" aria-hidden="true" />
        חבר מביא חבר
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        שתפו את הקוד שלכם: חברים מקבלים {data.friendPercent}% הנחה על ההזמנה הראשונה שלהם, ואתם
        מקבלים {data.rewardPercent}% הנחה על ההזמנה הבאה שלכם כשהם מזמינים.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code
          dir="ltr"
          className="rounded-lg border bg-white px-3 py-2 font-mono text-lg font-bold tracking-wide text-foreground"
        >
          {data.code}
        </code>
        <Button type="button" variant="outline" size="sm" className="press gap-1.5" onClick={copy}>
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? "הקישור הועתק" : "העתקת הקישור"}
        </Button>
      </div>

      <div className="mt-3">
        <a href={waHref} target="_blank" rel="noopener noreferrer">
          <Button type="button" className="press gap-1.5">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            שיתוף בוואטסאפ
          </Button>
        </a>
      </div>

      {/* The thank-you is a coupon, i.e. an offer: emailed only on request. */}
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
        <Checkbox
          checked={data.notify}
          disabled={saving}
          onCheckedChange={(v) => onNotify(v === true)}
          className="mt-0.5"
        />
        <span>כשחבר מזמין עם הקוד, שלחו לי את קופון התודה במייל.</span>
      </label>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        הקוד מיועד ללקוחות חדשים, להזמנה הראשונה, ולא חל על מוצרים שכבר במבצע. קופון התודה אישי,
        לשימוש אחד, ובתוקף {data.rewardDays} ימים.
      </p>
    </section>
  );
}
