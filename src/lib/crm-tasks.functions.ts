// Follow-up reminders and queue decisions — the admin server functions.
//
// All handlers gate on requireAdmin() and use the service-role client, like
// the rest of the CRM (admin-crm.functions.ts). The rules — when a reminder is
// due, when a snooze ends — live in crm-tasks.ts, which is pure and tested.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import { dateInputValue, decisionPatch, dueAtFromDateInput } from "@/lib/crm-tasks";

const emailSchema = z
  .string()
  .email()
  .transform((v) => v.trim().toLowerCase());

/** Same shape the queue builds: "<type>:<entity id>". Anything else is refused,
 *  so the table only ever holds keys the queue can produce. */
const actionKeySchema = z
  .string()
  .max(200)
  .regex(/^(thank_you|ready_to_ship|stuck_unpaid|recover_cart|review_request):[0-9a-f-]{36}$/);

// ---- Follow-ups --------------------------------------------------------------

export const listCustomerFollowUps = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ email: emailSchema }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("crm_followups")
      .select("id, title, due_at, done_at, created_at")
      .eq("customer_email", data.email)
      // Open first (done_at null sorts first ascending), then by due date.
      .order("done_at", { ascending: true, nullsFirst: true })
      .order("due_at", { ascending: true })
      .limit(100);
    if (error) {
      console.error("[listCustomerFollowUps]:", error);
      throw new Error("שגיאה בטעינת התזכורות.");
    }
    return rows ?? [];
  });

export const addFollowUp = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        email: emailSchema,
        title: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .transform((v) => v.replace(/<[^>]*>/g, "")),
        /** "YYYY-MM-DD" from the date input — the reminder falls due at 08:00
         *  Israel time that day. */
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const dueAt = dueAtFromDateInput(data.date);
    if (!dueAt) throw new Error("תאריך לא תקין.");
    const { error } = await supabaseAdmin.from("crm_followups").insert({
      customer_email: data.email,
      title: data.title,
      due_at: dueAt,
      created_by: adminId,
    });
    if (error) {
      console.error("[addFollowUp]:", error);
      throw new Error("שגיאה בשמירת התזכורת.");
    }
    return { ok: true as const };
  });

/** Mark done / undo, or push it three days on — the two things the queue row
 *  and the customer card let the owner do with a reminder. */
export const updateFollowUp = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["done", "reopen", "days3"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const now = Date.now();
    const patch =
      data.action === "done"
        ? { done_at: new Date(now).toISOString() }
        : data.action === "reopen"
          ? { done_at: null }
          : { due_at: dueAtFromDateInput(dateInputValue(now, 3))! };
    const { error } = await supabaseAdmin.from("crm_followups").update(patch).eq("id", data.id);
    if (error) {
      console.error("[updateFollowUp]:", error);
      throw new Error("שגיאה בעדכון התזכורת.");
    }
    return { ok: true as const };
  });

export const deleteFollowUp = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("crm_followups").delete().eq("id", data.id);
    if (error) throw new Error("שגיאה במחיקת התזכורת.");
    return { ok: true as const };
  });

// ---- Queue decisions ---------------------------------------------------------

export const setActionDecision = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        key: actionKeySchema,
        decision: z.enum(["today", "days3", "dismiss"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    const { error } = await supabaseAdmin.from("crm_action_state").upsert(
      {
        action_key: data.key,
        ...decisionPatch(data.decision, Date.now()),
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "action_key" },
    );
    if (error) {
      console.error("[setActionDecision]:", error);
      throw new Error("שגיאה בשמירה.");
    }
    return { ok: true as const };
  });

/** "Restore" — the item is open again, as if no decision had been made. */
export const clearActionDecision = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ key: actionKeySchema }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("crm_action_state")
      .delete()
      .eq("action_key", data.key);
    if (error) throw new Error("שגיאה בשחזור.");
    return { ok: true as const };
  });
