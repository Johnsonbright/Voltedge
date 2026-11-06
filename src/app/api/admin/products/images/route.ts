import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (!access.authorized) return access.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, message: 'A valid image upload is required.' }, { status: 400 });
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'Choose an image file to upload.' }, { status: 400 });
  }
  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json(
      { success: false, message: 'Use a JPEG, PNG, WebP, or AVIF image.' },
      { status: 415 }
    );
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ success: false, message: 'Image size must be between 1 byte and 5 MB.' }, { status: 413 });
  }

  const objectPath = `${crypto.randomUUID()}.${extension}`;
  const { error } = await access.database.storage
    .from('product-images')
    .upload(objectPath, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
  if (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to store the product image. Check the migration and storage bucket.' },
      { status: 500 }
    );
  }

  const { data } = access.database.storage.from('product-images').getPublicUrl(objectPath);
  return NextResponse.json({ success: true, image_url: data.publicUrl }, { status: 201 });
}
