const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { Readable, Writable } = require("node:stream");
const { test } = require("node:test");
const vm = require("node:vm");
const { S3 } = require("@aws-sdk/client-s3");

class HandlerHarness {
  constructor({ downloadError, resizeError } = {}) {
    this.downloaded = [];
    this.sourceImage = Buffer.from("source image");
    this.resizedImage = Buffer.from("resized image");
    const harness = this;
    class FakeS3 {
      async getObject(request) {
        harness.request = request;
        if (downloadError) throw downloadError;
        return { Body: Readable.from([harness.sourceImage]) };
      }
    }
    const dependencies = {
      "@aws-sdk/client-s3": { S3: FakeS3 },
      child_process: {
        execFile(binary, args, callback) {
          harness.resize = { binary, args };
          callback(resizeError || null);
        }
      },
      fs: {
        createWriteStream(destination) {
          harness.destination = destination;
          return new Writable({
            write(chunk, encoding, callback) {
              harness.downloaded.push(chunk);
              callback();
            }
          });
        },
        promises: { readFile: async () => harness.resizedImage }
      },
      path
    };
    const module = { exports: {} };
    vm.runInNewContext(readFileSync(path.join(__dirname, "../function.js"), "utf8"), {
      module,
      require: name => dependencies[name]
    });
    this.handler = module.exports;
  }
}

test("the patched AWS SDK retains the S3 API used by the handler", () => {
  const client = new S3({ region: "us-east-1" });
  assert.equal(typeof client.getObject, "function");
  client.destroy();
});

test("downloads, resizes, and returns the image using the existing response contract", async () => {
  const harness = new HandlerHarness();
  const result = await harness.handler.invoke();
  assert.equal(harness.request.Bucket, "my-images");
  assert.equal(harness.request.Key, "original-image.jpg");
  assert.deepEqual(Buffer.concat(harness.downloaded), harness.sourceImage);
  assert.equal(harness.resize.binary, path.resolve("imagemagick/bin/magick"));
  assert.deepEqual(Array.from(harness.resize.args), [harness.destination, "-resize", "100x100", harness.destination]);
  assert.equal(result.isBase64Encoded, true);
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["content-type"], "image/jpg");
  assert.deepEqual(Buffer.from(result.body, "base64"), harness.resizedImage);
});

test("propagates S3 download errors without attempting image conversion", async () => {
  const harness = new HandlerHarness({ downloadError: new Error("download failed") });
  await assert.rejects(harness.handler.invoke(), /download failed/);
  assert.equal(harness.resize, undefined);
});

test("propagates image conversion errors", async () => {
  const harness = new HandlerHarness({ resizeError: new Error("resize failed") });
  await assert.rejects(harness.handler.invoke(), /resize failed/);
});
