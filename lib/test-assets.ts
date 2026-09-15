"use client";

import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/utils";

/**
 * First-click images in the `test-assets` Storage bucket. Objects live under
 * <account_id>/<test_id>/… — the account prefix is what the bucket's RLS
 * policy checks, and the test prefix makes cleanup on test deletion a single
 * folder listing. The bucket is public-read (anonymous participants load the
 * images), so only non-confidential UI screenshots belong in it.
 */

const BUCKET = "test-assets";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** True when uploads can work at all (cloud mode with Storage available). */
export const canUploadTestAssets = () => !!supabase;

export async function uploadTestAsset(
  accountId: string,
  testId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: "Uploads need a cloud workspace — paste an image URL instead." };
  const ext = TYPES[file.type];
  if (!ext) return { error: "Use a PNG, JPEG, or WebP image." };
  if (file.size > MAX_BYTES) return { error: "Images can be at most 5 MB." };

  const path = `${accountId}/${testId}/${uid("img")}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600" });
  if (error) return { error: error.message };
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

/** True when a URL points into this bucket — i.e. the image came from an
    upload rather than a manually pasted link. */
export const isTestAssetUrl = (url: string) => url.includes(`/object/public/${BUCKET}/`);

/** Best-effort removal of a single uploaded image when the user clears it in
    the builder. Failures only leave an orphan, which the test-deletion sweep
    picks up later. */
export async function removeTestAssetByUrl(url: string): Promise<void> {
  if (!supabase) return;
  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // orphaned image is acceptable
  }
}

/** Best-effort removal of a deleted test's uploaded images. Fire-and-forget:
    a failure only leaves orphaned screenshots (non-personal) in the bucket.
    Called from the store's delete actions so every deletion path (single
    test, project cascade, bulk clear) cleans up. */
export async function removeTestAssets(accountId: string, testId: string): Promise<void> {
  if (!supabase) return;
  try {
    const folder = `${accountId}/${testId}`;
    // Page through the folder — a test can accumulate more than one batch of
    // screenshots over its life.
    for (let round = 0; round < 20; round++) {
      const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 100 });
      const names = (data ?? []).map((o) => `${folder}/${o.name}`);
      if (!names.length) break;
      await supabase.storage.from(BUCKET).remove(names);
      if (names.length < 100) break;
    }
  } catch {
    // orphaned images are acceptable; never block the delete flow
  }
}
