import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCampaigns,
  getCampaign,
  saveCampaign,
  previewCampaign,
  previewCampaignAudience,
  sendCampaignTestEmail,
  startCampaign,
  cancelCampaign,
  tickCampaign,
  searchCampaignProducts,
} from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Send, X, Play, FlaskConical } from "lucide-react";

export const Route = createFileRoute("/admin/campaigns")({ component: AdminCampaigns });

const MAX_PRODUCTS = 8;

const STATUS_HE: Record<string, string> = {
  draft: "טיוטה",
  sending: "בשליחה",
  sent: "נשלח",
  cancelled: "בוטל",
};
const STATUS_CLS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-amber-100 text-amber-900",
  sent: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-destructive/10 text-destructive",
};

type PickedProduct = { id: string; name: string; thumbnail_url: string | null };

function AdminCampaigns() {
  const qc = useQueryClient();
  const load = useServerFn(listCampaigns);
  const loadOne = useServerFn(getCampaign);
  const save = useServerFn(saveCampaign);
  const preview = useServerFn(previewCampaign);
  const loadAudience = useServerFn(previewCampaignAudience);
  const sendTest = useServerFn(sendCampaignTestEmail);
  const start = useServerFn(startCampaign);
  const cancel = useServerFn(cancelCampaign);
  const tick = useServerFn(tickCampaign);
  const searchProducts = useServerFn(searchCampaignProducts);

  const { data: campaigns = [], isFetching } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => load(),
    // A campaign in flight advances 20 recipients every 5 minutes; refresh so
    // the progress column doesn't look frozen.
    refetchInterval: 30_000,
  });

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [picked, setPicked] = useState<PickedProduct[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState("");
  const [testEmails, setTestEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(productQuery), 300);
    return () => clearTimeout(t);
  }, [productQuery]);

  const { data: productResults = [] } = useQuery({
    queryKey: ["campaign-product-search", debouncedQuery],
    enabled: composerOpen && debouncedQuery.trim().length >= 2,
    queryFn: () => searchProducts({ data: { q: debouncedQuery.trim() } }),
  });

  const resetComposer = () => {
    setEditingId(null);
    setSubject("");
    setIntro("");
    setPicked([]);
    setProductQuery("");
  };

  const openNew = () => {
    resetComposer();
    setComposerOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const c: any = await loadOne({ data: { id } });
      setEditingId(c.id);
      setSubject(c.subject ?? "");
      setIntro(c.intro_html ?? "");
      setPicked(
        (c.content?.products ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          thumbnail_url: p.thumbnail_url,
        })),
      );
      setComposerOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בטעינת הקמפיין.");
    }
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: { id: editingId ?? undefined, subject, intro, product_ids: picked.map((p) => p.id) },
      }),
    onSuccess: () => {
      toast.success("הקמפיין נשמר");
      setComposerOpen(false);
      resetComposer();
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בשמירה"),
  });

  const openDetail = async (id: string) => {
    setDetailId(id);
    setPreviewHtml(null);
    try {
      const p = await preview({ data: { id } });
      setPreviewHtml(p.html);
      setPreviewSubject(p.subject);
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בהצגת התצוגה המקדימה.");
    }
  };

  const startMutation = useMutation({
    mutationFn: (id: string) => start({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`השליחה החלה — ${r.recipients} נמענים בתור`);
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בהתחלת השליחה"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("הקמפיין בוטל");
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בביטול"),
  });

  const tickMutation = useMutation({
    mutationFn: () => tick(),
    // A tick that sent nothing is usually a broken server, not an empty queue —
    // report the real reason instead of a green "0 נשלחו".
    onSuccess: (r: any) => {
      if (r.status === "email-not-configured" || r.status === "claim-failed") {
        toast.error(r.error ?? "השליחה נכשלה — לא נשלחה אף הודעה.");
      } else if (r.status === "idle") {
        toast.info("אין קמפיין בשליחה");
      } else {
        toast.success(
          `נשלחה קבוצה: ${r.sent} נשלחו, ${r.failed} נכשלו, ${r.skipped} דילגו (הוסרו מהתפוצה)`,
        );
      }
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בשליחה"),
  });

  const testMutation = useMutation({
    mutationFn: (v: { id: string; email: string }) =>
      sendTest({ data: { campaignId: v.id, email: v.email } }),
    onSuccess: (r: any) => toast.success(`נשלחה הודעת בדיקה ל-${r.email}`),
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בשליחת הבדיקה"),
  });

  const detail = campaigns.find((c: any) => c.id === detailId);

  // Real headcount for the confirm step. Loaded only while a draft's detail
  // dialog is open — nothing here sends, it just re-runs the audience query.
  const {
    data: audience,
    isFetching: audienceLoading,
    isError: audienceError,
    refetch: refetchAudience,
  } = useQuery({
    queryKey: ["campaign-audience"],
    queryFn: () => loadAudience(),
    enabled: !!detailId && detail?.status === "draft",
    staleTime: 60_000,
  });

  const togglePick = (p: any) => {
    setPicked((cur) => {
      if (cur.some((x) => x.id === p.id)) return cur.filter((x) => x.id !== p.id);
      if (cur.length >= MAX_PRODUCTS) {
        toast.error(`אפשר לבחור עד ${MAX_PRODUCTS} מוצרים`);
        return cur;
      }
      return [...cur, { id: p.id, name: p.name, thumbnail_url: p.thumbnail_url }];
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="font-display text-2xl font-bold">דיוור ({campaigns.length})</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => tickMutation.mutate()}
            disabled={tickMutation.isPending}
            className="gap-2"
          >
            <Send className="h-4 w-4" /> {tickMutation.isPending ? "שולח..." : "שלח קבוצה עכשיו"}
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> קמפיין חדש
          </Button>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        הדיוור נשלח רק לנמענים שנתנו הסכמה שיווקית (רשימת התפוצה או הסכמה בחשבון). כל הודעה נושאת
        סימון "פרסומת" וקישור הסרה אישי. השליחה מתקדמת אוטומטית כ-20 נמענים כל 5 דקות. מומלץ לשלוח
        קודם הודעת בדיקה לכתובת אחת — היא זהה להודעה שתישלח בפועל, כולל קישור ההסרה שבה, שהוא פעיל.
      </p>

      <div
        className={`rounded-lg border bg-card overflow-x-auto transition-opacity duration-200 ease-out ${isFetching ? "opacity-60" : ""}`}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-right">
              <th className="p-3 font-medium">נושא</th>
              <th className="p-3 font-medium">סטטוס</th>
              <th className="p-3 font-medium">התקדמות</th>
              <th className="p-3 font-medium">נוצר</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  אין קמפיינים עדיין.
                </td>
              </tr>
            )}
            {campaigns.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 max-w-xs">
                  <div className="line-clamp-2">{c.subject}</div>
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[c.status] ?? ""}`}
                  >
                    {STATUS_HE[c.status] ?? c.status}
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {c.recipient_count > 0 ? (
                    <>
                      {c.sent_count}/{c.recipient_count}
                      {c.failed_count > 0 && (
                        <span className="text-destructive text-xs"> · {c.failed_count} נכשלו</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-xs">
                  {new Date(c.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {c.status === "draft" && (
                      <>
                        {/* Single-address proof send. Never touches the audience. */}
                        <Input
                          type="email"
                          dir="ltr"
                          placeholder="test@example.com"
                          aria-label={`כתובת לשליחת בדיקה — ${c.subject}`}
                          className="h-8 w-44 text-xs"
                          value={testEmails[c.id] ?? ""}
                          onChange={(e) => setTestEmails((m) => ({ ...m, [c.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={
                            (testMutation.isPending && testMutation.variables?.id === c.id) ||
                            !(testEmails[c.id] ?? "").trim()
                          }
                          onClick={() =>
                            testMutation.mutate({
                              id: c.id,
                              email: (testEmails[c.id] ?? "").trim(),
                            })
                          }
                        >
                          <FlaskConical className="h-4 w-4" />
                          {testMutation.isPending && testMutation.variables?.id === c.id
                            ? "שולח..."
                            : "שלח בדיקה"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(c.id)}>
                          עריכה
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openDetail(c.id)}>
                      פרטים
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Composer */}
      <Dialog
        open={composerOpen}
        onOpenChange={(v) => {
          setComposerOpen(v);
          if (!v) resetComposer();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת קמפיין" : "קמפיין חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="c-subject">נושא *</Label>
              <Input
                id="c-subject"
                maxLength={150}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                יישלח כ־<span className="font-mono">פרסומת: {subject || "…"}</span>
              </p>
            </div>
            <div>
              <Label htmlFor="c-intro">פתיח</Label>
              <Textarea
                id="c-intro"
                rows={5}
                maxLength={2000}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-products">
                מוצרים ({picked.length}/{MAX_PRODUCTS})
              </Label>
              {picked.length > 0 && (
                <div className="flex flex-wrap gap-2 my-2">
                  {picked.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                    >
                      {p.name.slice(0, 30)}
                      <button
                        type="button"
                        onClick={() => togglePick(p)}
                        aria-label={`הסר ${p.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                id="c-products"
                placeholder="חיפוש מוצר להוספה..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
              {productResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border divide-y">
                  {productResults.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePick(p)}
                      className="flex w-full items-center gap-2 p-2 text-right text-sm [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                    >
                      {p.thumbnail_url && (
                        <img
                          src={p.thumbnail_url}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      )}
                      <span className="flex-1 line-clamp-1">{p.name}</span>
                      {picked.some((x) => x.id === p.id) && (
                        <span className="text-accent text-xs">נבחר ✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !subject.trim()}
            >
              {saveMutation.isPending ? "שומר..." : "שמור טיוטה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail + preview */}
      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.subject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[detail.status] ?? ""}`}
                  >
                    {STATUS_HE[detail.status] ?? detail.status}
                  </span>
                  <span>נמענים: {detail.recipient_count}</span>
                  <span>נשלחו: {detail.sent_count}</span>
                  <span>נכשלו: {detail.failed_count}</span>
                  {/* Only exact once the queue is drained: the remainder is
                      then precisely the recipients skipped as unsubscribed. */}
                  {detail.status === "sent" &&
                    detail.recipient_count - detail.sent_count - detail.failed_count > 0 && (
                      <span>
                        דילגו: {detail.recipient_count - detail.sent_count - detail.failed_count}
                      </span>
                    )}
                </div>

                <div className="rounded-md border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 text-xs">
                    נושא: <span className="font-mono">{previewSubject}</span>
                  </div>
                  {previewHtml ? (
                    <iframe
                      title="תצוגה מקדימה"
                      srcDoc={previewHtml}
                      sandbox=""
                      className="w-full h-[420px] bg-white"
                    />
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      טוען תצוגה מקדימה...
                    </div>
                  )}
                </div>

                {/* Audience headcount — the send button stays locked until it
                    loads, so nobody blasts a list of unknown size. */}
                {detail.status === "draft" && (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs">
                    {audienceError ? (
                      <div className="flex flex-wrap items-center gap-2 text-destructive">
                        <span>לא הצלחנו לחשב את מספר הנמענים.</span>
                        <Button size="sm" variant="outline" onClick={() => refetchAudience()}>
                          נסה שוב
                        </Button>
                      </div>
                    ) : !audience ? (
                      <span className="text-muted-foreground">מחשב את מספר הנמענים...</span>
                    ) : (
                      <>
                        <div>
                          הקמפיין יישלח ל-<strong>{audience.total}</strong> נמענים
                          {audienceLoading && " (מתעדכן...)"}
                        </div>
                        {audience.sample.length > 0 && (
                          <div className="mt-1 text-muted-foreground break-all" dir="ltr">
                            {audience.sample.join(", ")}
                            {audience.total > audience.sample.length ? " …" : ""}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {detail.status === "draft" && (
                    <Button
                      className="gap-2"
                      disabled={startMutation.isPending || !audience || audience.total === 0}
                      onClick={() => {
                        if (!audience) return;
                        if (
                          confirm(
                            `להתחיל שליחה? הקמפיין יישלח ל-${audience.total} נמענים. הפעולה אינה הפיכה עבור נמענים שכבר קיבלו.`,
                          )
                        ) {
                          startMutation.mutate(detail.id);
                        }
                      }}
                    >
                      <Play className="h-4 w-4" />
                      {startMutation.isPending
                        ? "מתחיל..."
                        : !audience
                          ? "טוען נמענים..."
                          : audience.total === 0
                            ? "אין נמענים"
                            : `התחל שליחה (${audience.total})`}
                    </Button>
                  )}
                  {detail.status === "sending" && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={tickMutation.isPending}
                      onClick={() => tickMutation.mutate()}
                    >
                      <Send className="h-4 w-4" /> שלח קבוצה עכשיו
                    </Button>
                  )}
                  {(detail.status === "draft" || detail.status === "sending") && (
                    <Button
                      variant="outline"
                      className="text-destructive"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        if (confirm("לבטל את הקמפיין? נמענים שטרם קיבלו יוסרו מהתור.")) {
                          cancelMutation.mutate(detail.id);
                        }
                      }}
                    >
                      ביטול קמפיין
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
