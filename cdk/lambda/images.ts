// https://gist.github.com/mkuklis/67d8b95aa948d4f3f1e41e5554dc7056
// https://www.lydiahallie.dev/blog/aws-s3-trigger-with-nodejs-aws-lambda

import * as sharp from 'sharp'
import {S3, Lambda} from 'aws-sdk'
import { APIGatewayProxyResult, S3Event } from "aws-lambda";

// const downloadParam = {
//   Bucket: process.env.UPLOAD_BUCKET as string,
//   Key: "arteum-ro-TVFx7iFAAdQ-unsplash.jpg",
// }
// exports.info = async function(event: S3.PutBucketNotificationRequest): Promise<APIGatewayProxyResult> {

//   return {
//     statusCode: 200,
//     body: 'hi'
//   }
// }

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
