import { supabase } from '@/lib/supabase';

const IMAGE_EXTS = /\.(jpe?g|png|webp|gif|svg)$/i;

export interface StoragePhoto {
  id: string;
  name: string;
  src: string;
}

export async function listBucketPhotos(bucket: string): Promise<StoragePhoto[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });

  if (error || !data) return [];

  return data
    .filter(f => IMAGE_EXTS.test(f.name))
    .map((f, i) => ({
      id: String(i),
      name: f.name,
      src: supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl,
    }));
}
