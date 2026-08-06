import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NotificationPreferences = {
  enabled: boolean;
  lesson_minutes: number;
  event_minutes: number;
  payment_notifications: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false,
  lesson_minutes: 30,
  event_minutes: 30,
  payment_notifications: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notification-preferences", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NotificationPreferences> => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("enabled, lesson_minutes, event_minutes, payment_notifications")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_PREFERENCES;
    },
  });
}

export function usePushNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification === "undefined" ? "default" : Notification.permission,
  );
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const publicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;

  const preferencesQuery = useNotificationPreferences();

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    if (supported) {
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.pushManager.getSubscription())
        .then((subscription) => setSubscribed(!!subscription))
        .catch(() => setSubscribed(false));
    }
  }, [supported]);

  const savePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user) return;
    const current = preferencesQuery.data ?? DEFAULT_PREFERENCES;
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      ...current,
      ...updates,
    });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["notification-preferences", user.id] });
  };

  const enable = async () => {
    if (!user || !supported) throw new Error("Este navegador não oferece notificações push.");
    if (!publicKey) throw new Error("A chave pública VAPID ainda não foi configurada.");
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error("Permissão de notificações não concedida.");

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.["p256dh"] || !serialized.keys["auth"]) {
        throw new Error("O navegador não retornou uma subscription válida.");
      }

      const { error } = await supabase.rpc("claim_push_subscription", {
        p_endpoint: serialized.endpoint,
        p_p256dh: serialized.keys["p256dh"],
        p_auth: serialized.keys["auth"],
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
      await savePreferences({ enabled: true });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (supported) {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
          await subscription.unsubscribe();
        }
      }
      const { count, error } = await supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      if (!count) await savePreferences({ enabled: false });
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  };

  return {
    supported,
    configured: !!publicKey,
    permission,
    busy,
    subscribed,
    preferences: preferencesQuery.data ?? DEFAULT_PREFERENCES,
    isLoading: preferencesQuery.isLoading,
    enable,
    disable,
    savePreferences,
  };
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}
