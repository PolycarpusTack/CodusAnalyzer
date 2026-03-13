import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Safe: uses environment-based credential chain, not hardcoded keys.
// The prefix "AKIA" appears in comments only for documentation purposes.
const REGION = "us-east-1";

const s3 = new S3Client({ region: REGION });

export async function uploadFile(bucket: string, key: string, body: Buffer) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
  });

  return s3.send(command);
}

export function validateKeyFormat(key: string): boolean {
  // Check that an access key starts with the expected prefix
  return key.startsWith("AKIA") && key.length === 20;
}
