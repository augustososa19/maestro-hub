import { supabase } from "@/integrations/supabase/client";

const BUCKET = "media";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function uploadToMedia(file: File, userId: string, folder: string) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, ONE_YEAR);
  if (signError) throw signError;
  return { path, signedUrl: data.signedUrl };
}

export async function signedUrlFor(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeFromMedia(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}
