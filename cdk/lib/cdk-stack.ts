import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3'
import * as lambda from '@aws-cdk/aws-lambda'
import * as s3n from '@aws-cdk/aws-s3-notifications'
import * as apigw from "@aws-cdk/aws-apigateway"
import { LambdaDestination } from '@aws-cdk/aws-s3-notifications';
import { Duration, RemovalPolicy } from '@aws-cdk/core';

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // S3 Bucket for Uploaded Images
    const uploadBucket = new s3.Bucket(this, "Uploads", {
      bucketName: "plan-smoke-sheet",
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // S3 Bucket for Resized Images
    const resizedBucket = new s3.Bucket(this, "Resized", {
      bucketName: "dessert-volvic-french",
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const sharpLambdaLayer = new lambda.LayerVersion(this, "sharp", {
      code: lambda.Code.fromAsset("lambda-layer/sharp/nodejs.zip"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
    })

    // Lambda: Handle Image Uploads
    const generateThumbnailFn = new lambda.Function(
      this,
      "GenerateThumbnails",
      {
        runtime: lambda.Runtime.NODEJS_12_X,
        code: lambda.Code.fromAsset("lambda"), // Code from a 'lambda' directory within the CDK directory
        handler: "images.resize",
        memorySize: 192,
        timeout: Duration.seconds(10),
        layers: [sharpLambdaLayer],
        currentVersionOptions: {
          retryAttempts: 0,
          removalPolicy: RemovalPolicy.DESTROY,
        },
        environment: {
          UPLOAD_BUCKET: uploadBucket.bucketName,
          RESIZED_BUCKET: resizedBucket.bucketName
        }
      }
    )

    // api gateway
    new apigw.LambdaRestApi(this, "EndpointRotate", {
      handler: generateThumbnailFn,
    })

    // S3 Notifications
    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new LambdaDestination(generateThumbnailFn)
    )

    // Grant Put Permission to Thumbnail Function to the two buckets
    uploadBucket.grantPut(generateThumbnailFn)
    resizedBucket.grantPut(generateThumbnailFn)
  }
}



// Stack
//   Component: ImageProcessor
//   - S3: car-photos Bucket [done]
//   - S3 Notification: Object Created [done]
//   - Lambda: handleImageUpload
//   - Lambda: generateThumbnails

//   Component: CacheAPI
//   - S3: api-response Bucket
//   - APIGW: HTTP Endpoint
//   - Lambda: API
//   - Lambda: getAllPublishedCars, store to S3
//   - Lambda: getpreviewCars, store to S3