const { execFile } = require("child_process");
const { S3 }       = require("@aws-sdk/client-s3");
const fs           = require("fs");
const path         = require("path");
const localFile    = path.resolve("/tmp/original-image.jpg");
const s3           = new S3();
const s3Key        = "original-image.jpg";

//
// Remember to change this!
//
const imageBucketName = "upload-example-2-my-images"

module.exports.invoke = async () => {
  await downloadFile(s3Key, localFile);
  await resizeImage(localFile);
  return await sendFileAsResponse(localFile);
}

async function downloadFile(s3Key, localFile) {
  const image = await s3.getObject({
    Bucket: imageBucketName,
    Key: s3Key
  });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(localFile);
    writer.on("close", resolve);
    writer.on("error", reject);
    image.Body.pipe(writer);
  });
}

async function resizeImage(localFile) {
  await new Promise((resolve, reject) => {
    execFile(
      path.resolve("imagemagick/bin/magick"), 
      [
        localFile,
        "-resize",
        "100x100",
        localFile
      ], 
      (error, stdout, stderr) => {
        if (error !== null) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
}

async function sendFileAsResponse(localFile) {
  return {
    isBase64Encoded: true,
    statusCode: 200,
    headers: { "content-type": "image/jpg"},
    body: (await fs.promises.readFile(localFile)).toString('base64')
  }
}