import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_URL,
} = process.env;

export function r2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: R2_SECRET_ACCESS_KEY ?? '',
  },
});

const BUCKET = R2_BUCKET ?? '';
const PUBLIC_URL = R2_PUBLIC_URL ?? '';

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const abort = AbortSignal.timeout(30_000);
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
    { abortSignal: abort },
  );
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
