// https://gist.github.com/mkuklis/67d8b95aa948d4f3f1e41e5554dc7056
// https://www.lydiahallie.dev/blog/aws-s3-trigger-with-nodejs-aws-lambda

import * as sharp from 'sharp'
import {S3, Lambda} from 'aws-sdk'
import { APIGatewayProxyResult, S3Event, APIGatewayProxyEvent } from "aws-lambda";

exports.getPreSignedURLToS3 = async function(event: APIGatewayProxyEvent) { // TODO: what are their definitions
  // https://medium.com/@ray0427/deploy-serverless-s3-uploader-by-aws-cdk-78561123adc
  try {
    const s3 = new S3()
    const managedupload = S3.ManagedUpload
    const req: S3.Types.PutObjectRequest = {
      Bucket: "plan-smoke-sheet", //TODO: process.env.BUCKET_NAME
      Key: "pic1.png", //TODO: event.body.filename
      // TODO: more fields and error handling: https://serverlessfirst.com/serverless-photo-upload-api/
      // TODO: useful understanding https://devcenter.heroku.com/articles/s3-upload-node
    }
    const response = await s3.getSignedUrlPromise('putObject', req)
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      //@ts-ignore
      body: response,
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        body: e
      }
    }
  }
}

exports.resize = async function (
  event: S3Event
): Promise<APIGatewayProxyResult> {
  try {
    const s3 = new S3()

    const params: S3.GetObjectRequest = {
      Bucket: event.Records[0].s3.bucket.name,
      Key: event.Records[0].s3.object.key,
    } 

    const image = await s3.getObject(params).promise()
    //@ts-ignore
    const resizedImg = await sharp(image.Body)
      .resize(50)
      .png({ quality: 85 })
      .toBuffer()
    
    const upload = await s3
      .putObject({
        Bucket: process.env.RESIZED_BUCKET as string,
        Body: resizedImg,
        Key: `ouput${Date.now()/1000}.png`,
      })
      .promise()
    console.log(upload)

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
      },
      //@ts-ignore
      body: 'done',
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(err)
    }
  }
}
