import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = { "content-type": "application/json" };

Deno.serve(async (request) => {
  const providedSecret = request.headers.get("x-cron-secret");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: "Missing server configuration" }), {
      status: 503,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // O segredo do agendador fica no Vault do banco; CRON_SECRET é apenas fallback.
  const { data: vaultSecret } = await supabase.rpc("get_cron_secret");
  const expectedSecret = (vaultSecret as string | null) ?? Deno.env.get("CRON_SECRET") ?? null;
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60_000);
  const windowEnd = new Date(now.getTime() + 3 * 60_000);
  let sent = 0;
  let failed = 0;

  const { data: preferences, error: preferencesError } = await supabase
    .from("notification_preferences")
    .select("user_id, lesson_minutes, event_minutes, payment_notifications")
    .eq("enabled", true);
  if (preferencesError) throw preferencesError;

  for (const preference of preferences ?? []) {
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", preference.user_id);
    if (subscriptionsError) {
      console.error("push_subscriptions", preference.user_id, subscriptionsError);
      failed++;
      continue;
    }
    if (!subscriptions?.length) continue;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", preference.user_id)
      .maybeSingle();
    if (profileError) {
      console.error("profiles", preference.user_id, profileError);
      failed++;
      continue;
    }
    const timezone = safeTimezone(profile?.timezone);

    const lessonTargetStart = new Date(windowStart.getTime() + preference.lesson_minutes * 60_000);
    const lessonTargetEnd = new Date(windowEnd.getTime() + preference.lesson_minutes * 60_000);
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, starts_at, location")
      .eq("teacher_id", preference.user_id)
      .in("status", ["agendada", "remarcada"])
      .gte("starts_at", lessonTargetStart.toISOString())
      .lt("starts_at", lessonTargetEnd.toISOString());
    if (lessonsError) {
      console.error("lessons", preference.user_id, lessonsError);
      failed++;
    }

    for (const lesson of lessonsError ? [] : (lessons ?? [])) {
      const start = new Date(lesson.starts_at);
      const reminderAt = new Date(start.getTime() - preference.lesson_minutes * 60_000);
      const result = await sendToSubscriptions({
        supabase,
        subscriptions,
        userId: preference.user_id,
        resourceType: "lesson",
        resourceId: lesson.id,
        reminderAt,
        payload: {
          title: "Aula em breve",
          body: `${formatTime(start, timezone)}${lesson.location ? ` · ${lesson.location}` : ""}`,
          url: `/agenda?date=${civilDate(start, timezone)}&lessonId=${lesson.id}`,
          tag: `lesson-${lesson.id}`,
        },
      });
      sent += result.sent;
      failed += result.failed;
    }

    const eventSearchEnd = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    const { data: events, error: eventsError } = await supabase
      .from("calendar_events")
      .select("id, title, starts_at, location, reminder_minutes")
      .eq("teacher_id", preference.user_id)
      .eq("status", "ativo")
      .gte("starts_at", windowStart.toISOString())
      .lte("starts_at", eventSearchEnd.toISOString());
    if (eventsError) {
      console.error("calendar_events", preference.user_id, eventsError);
      failed++;
    }

    for (const event of eventsError ? [] : (events ?? [])) {
      const start = new Date(event.starts_at);
      const minutes = event.reminder_minutes ?? preference.event_minutes;
      const reminderAt = new Date(start.getTime() - minutes * 60_000);
      if (reminderAt < windowStart || reminderAt >= windowEnd) continue;
      const result = await sendToSubscriptions({
        supabase,
        subscriptions,
        userId: preference.user_id,
        resourceType: "calendar_event",
        resourceId: event.id,
        reminderAt,
        payload: {
          title: event.title,
          body: `${formatTime(start, timezone)}${event.location ? ` · ${event.location}` : ""}`,
          url: `/agenda?date=${civilDate(start, timezone)}&eventId=${event.id}`,
          tag: `event-${event.id}`,
        },
      });
      sent += result.sent;
      failed += result.failed;
    }

    if (preference.payment_notifications) {
      const local = localParts(now, timezone);
      if (local.hour === 9) {
        const { data: payments, error: paymentsError } = await supabase
          .from("financial_transactions")
          .select("id, student_name, description, amount")
          .eq("teacher_id", preference.user_id)
          .eq("type", "receita")
          .in("status", ["pendente", "atrasado"])
          .eq("due_date", local.date);
        if (paymentsError) {
          console.error("financial_transactions", preference.user_id, paymentsError);
          failed++;
        }
        for (const payment of paymentsError ? [] : (payments ?? [])) {
          const result = await sendToSubscriptions({
            supabase,
            subscriptions,
            userId: preference.user_id,
            resourceType: "payment",
            resourceId: payment.id,
            reminderAt: new Date(`${local.date}T09:00:00.000Z`),
            payload: {
              title: "Pagamento com vencimento hoje",
              body: `${payment.student_name ?? payment.description} · ${money(payment.amount)}`,
              url: "/financeiro",
              tag: `payment-${payment.id}-${local.date}`,
            },
          });
          sent += result.sent;
          failed += result.failed;
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, failed }), { headers: corsHeaders });
});

async function sendToSubscriptions({
  supabase,
  subscriptions,
  userId,
  resourceType,
  resourceId,
  reminderAt,
  payload,
}: any) {
  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    const { data: deliveryId, error: claimError } = await supabase.rpc(
      "claim_notification_delivery",
      {
        p_user_id: userId,
        p_subscription_id: subscription.id,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_reminder_at: reminderAt.toISOString(),
      },
    );
    if (claimError) {
      console.error("claim_notification_delivery", claimError);
      failed++;
      continue;
    }
    if (!deliveryId) continue;

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
      const { error: sentUpdateError } = await supabase
        .from("notification_deliveries")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", deliveryId);
      if (sentUpdateError) {
        console.error("notification_deliveries sent", sentUpdateError);
        failed++;
      } else {
        sent++;
      }
    } catch (error: any) {
      const statusCode = error?.statusCode;
      const { error: failedUpdateError } = await supabase
        .from("notification_deliveries")
        .update({ status: "failed", error: String(error?.message ?? error) })
        .eq("id", deliveryId);
      if (failedUpdateError) console.error("notification_deliveries failed", failedUpdateError);
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
      }
      failed++;
    }
  }
  return { sent, failed };
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}

function safeTimezone(value: string | null | undefined) {
  const timezone = value || "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "America/Sao_Paulo";
  }
}

function civilDate(date: Date, timezone: string) {
  return localParts(date, timezone).date;
}

function formatTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
