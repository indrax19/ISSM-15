import { usersAPI } from "@/integrations/firebase/usersAPI";
import { supabase } from "@/integrations/supabase/client";

export async function uploadUserSignature(userId: string, file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Upload a PNG, JPG, or WebP signature image");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Signature image must be smaller than 5MB");
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filePath = `signature_${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("company-logos").upload(filePath, file);
  if (error) throw error;

  const signatureUrl = `${supabase.storage.from("company-logos").getPublicUrl(filePath).data.publicUrl}?v=${Date.now()}`;
  await usersAPI.update(userId, { signatureUrl });
  localStorage.setItem(`user_signature_${userId}`, signatureUrl);
  return signatureUrl;
}
