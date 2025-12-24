import { S3 } from "@aws-sdk/client-s3";
import { streamToBuffer } from "./streamToBuffer";
import { Readable } from "stream";
import mime from "mime-types";
import { SOURCE_FALLBACKS } from "./image";

export function getMimeType(key: string): string {
  return mime.lookup(key) || "application/octet-stream";
}

export function getS3Client(): S3 {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials are not defined");
  }

  return new S3({
    region: "us-east-1",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint: "https://s3.marvideo.fr",
    forcePathStyle: true,
  });
}

export async function getImageWithFallback(
  bucket: string,
  path: string
): Promise<Buffer> {
  const keys = buildFallbackKeys(path);

  for (const key of keys) {
    try {
      return await getImageFromS3(bucket, key);
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Image not found in any supported format");
}

export async function getImageFromS3(bucket: string, key: string) {
  const res = await getS3Client().getObject({
    Bucket: bucket,
    Key: key,
  });

  if (!res.Body) {
    throw new Error("S3 object body is empty");
  }


  return streamToBuffer(res.Body as Readable);
}

function buildFallbackKeys(path: string): string[] {
  const base = path.replace(/\.(webp|png|jpe?g)$/i, "");
  return SOURCE_FALLBACKS.map(ext => `${base}.${ext}`);
}