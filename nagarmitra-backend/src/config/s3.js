import { S3Client, PutObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function readEnv() {
  const region = (process.env.AWS_REGION || "ap-south-1").trim();
  const bucket = (process.env.S3_BUCKET || "").trim();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || "").trim();

  const missing = [];
  if (!bucket) missing.push("S3_BUCKET");
  if (!accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  if (missing.length) {
    throw new Error(`S3 not configured. Missing env: ${missing.join(", ")}`);
  }

  return { region, bucket, accessKeyId, secretAccessKey };
}

export function getBucketName() {
  return readEnv().bucket;
}

function createClient() {
  const { region, accessKeyId, secretAccessKey } = readEnv();
  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function createPresignedPutUrl({ key, contentType, public: isPublic = false }) {
  const { bucket } = readEnv();
  const s3 = createClient();

  // Optional: light-touch validation to fail fast on wrong bucket/region
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (e) {
    // Common diagnostics
    const hint = e?.name === "NotFound" ? "Check bucket name and region" : e?.name;
    throw new Error(`HeadBucket failed (${hint}). Ensure bucket exists and region matches.`);
  }

  const commandParams = {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  };
  if (isPublic) commandParams.ACL = "public-read";

  try {
    const command = new PutObjectCommand(commandParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
    return url;
  } catch (err) {
    // Surface the underlying AWS error for easier debugging
    throw new Error(`Presign failed: ${err.name}: ${err.message}`);
  }
}
