import AWS from "aws-sdk";

// Vulnerable: hardcoded AWS credentials
const awsConfig = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
};

AWS.config.update(awsConfig);

const s3 = new AWS.S3();

export async function uploadFile(bucket: string, key: string, body: Buffer) {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: body,
  };

  return s3.upload(params).promise();
}
