# AWS Lambda Image Resize Example (with ImageMagick)

This repository deploys an AWS Lambda Function that resizes images using ImageMagick.

**Blog post:** https://upload.io/blog/aws-lambda-image-resize/

## Quick Start

**Important:** 

- Replace `my-lambda-function-code` and `my-images` with unique S3 bucket names!

### Deploying the Lambda Function

1. Checkout the repository:
 
   ```bash
   git clone git@github.com:upload-io/aws-lambda-image-magick-resize-example.git
   
   cd aws-lambda-image-magick-resize-example
   ```

2. Install NPM dependencies:

   ```bash
   npm install
   ```

3. Create the S3 bucket stack (remember: change the bucket names in `ParameterValue` below):

   ```bash
   aws cloudformation create-stack \
     --stack-name my-bucket-stack \
     --parameters ParameterKey=LambdaCodeBucketName,ParameterValue=my-lambda-function-code \
                  ParameterKey=ImageBucketName,ParameterValue=my-images \
     --template-body file://buckets-cloudformation.yml
   ```

4. Update `function.js` > `imageBucketName` to your image bucket's name.

5. Upload the Lambda Function's code:
   
   ```bash
   zip -ry function-dist.zip .
   aws s3 cp function-dist.zip s3://my-lambda-function-code/AwsLambdaImageResizeExample.zip
   ```

6. Deploy the Lambda Function (remember: change the bucket names in `ParameterValue` below):

   ```bash
   aws cloudformation create-stack \
     --stack-name my-image-resize-lambda \
     --parameters ParameterKey=LambdaCodeBucketName,ParameterValue=my-lambda-function-code \
                  ParameterKey=ImageBucketName,ParameterValue=my-images \
     --template-body file://function-cloudformation.yml \
     --capabilities CAPABILITY_NAMED_IAM
   ```

7. Wait for the Lambda Function's stack to complete:

   ```bash
   aws cloudformation describe-stack-events \
     --stack-name my-image-resize-lambda
   ```
   
   **Note:** the latest event should read `"ResourceStatus": "CREATE_COMPLETE"`.
   
### Invoking the function

1. Upload the image to resize:

   ```bash
   aws s3 cp test-image.jpg s3://my-images/test-image.jpg
   ```

2. Invoke the function:

   ```bash
   aws lambda invoke \
     --function-name AwsLambdaImageResizeExample \
     function-result.json
   ```

3. "See" the result:

   ```bash
   cat function-result.json
   ```
   
   Outputs:

   ```json
   {
     "isBase64Encoded": true,
     "statusCode": 200,
     "headers": {
       "content-type": "image/jpg"
     },
     "body": "/9j/4AAQSkZJRg...9k="
   }
   ```
   
   `body` contains the resized image... as a base64-encoded string (see note below).

**Note:** AWS Lambda only supports JSON responses: to return the raw image, you'll need to put API Gateway in front of the Lambda function.
