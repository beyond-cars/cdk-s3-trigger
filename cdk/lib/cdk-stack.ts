import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3'
import * as lambda from '@aws-cdk/aws-lambda'
import * as iam from '@aws-cdk/aws-iam'
import * as apigw from "@aws-cdk/aws-apigateway"
import { LambdaDestination } from '@aws-cdk/aws-s3-notifications';
import { Duration, RemovalPolicy } from '@aws-cdk/core';

import { CorsOptions, Cors } from '@aws-cdk/aws-apigateway';
import { PolicyStatement } from '@aws-cdk/aws-iam';

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const corsOptions: s3.CorsRule = {
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
      allowedOrigins: Cors.ALL_ORIGINS,
      allowedHeaders: ['*']
    }

    // S3 Bucket for Uploaded Images
    const uploadBucket = new s3.Bucket(this, "Uploads", {
      bucketName: "plan-smoke-sheet",
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: [corsOptions],
    })

    // S3 Bucket for Resized Images
    const resizedBucket = new s3.Bucket(this, "Resized", {
      bucketName: "dessert-volvic-french",
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: [corsOptions],
    })

    // new IAM user whose access key can be used to upload photos to S3 Buckets, the ARN are set to only allow put object
    // this is for client side s3.upload() function. somehow presigned URL doesn't give progress bar, i want to check if s3.upload can.
    // 2020-09-10 20:19:25 - This IAM role can still be useful and can be paired with the Uppy AWS Access Key
    // NOTE: https://stackoverflow.com/questions/62880797/create-aws-user-with-s3-permissions-with-aws-cdk
    const AllowS3PutObjectInUploadBucket = new iam.PolicyStatement({
      resources: [`arn:aws:s3:::${uploadBucket.bucketName}`],
      actions: [
        "s3:PutObject"
      ]
    })

    const uploadUserPolicy = new iam.Policy(this, "uploadUserPolicy", {
      policyName: "uploadUserPolicy",
      statements: [AllowS3PutObjectInUploadBucket],
    })
    

    const uploadUserGroup = new iam.Group(this, "uploadUserAccessGroup", {
      groupName: "uploadUserAccessGroup",
    })
    uploadUserGroup.attachInlinePolicy(uploadUserPolicy)

    const uploadUser = new iam.User(this, "uploadUser", {
      groups: [uploadUserGroup]
    })
    const accessKey = new iam.CfnAccessKey(this, "uploadAccessKey", {
      userName: uploadUser.userName,
    })

    new cdk.CfnOutput(this, "accessKeyId", { value: accessKey.ref })
    new cdk.CfnOutput(this, "secretAccessKeyE89D01", {
      value: accessKey.attrSecretAccessKey,
    })

    // Add a Lambda Layer here to be shared for sharp library. - rmb it needs to be npm install under linux os
    // TODO: this layer should be in its own ?
    const sharpLambdaLayer = new lambda.LayerVersion(this, "sharp", {
      code: lambda.Code.fromAsset("lambda-layer/sharp/nodejs.zip"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
    })

    // Lambda: Get Presigned URL
    const presignS3URLFn = new lambda.Function(this, "getPresignURLS3", {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset("lambda"),
      handler: "images.getPreSignedURLToS3",
      layers: [sharpLambdaLayer],
      currentVersionOptions: {
        retryAttempts: 0,
      },
    })

    new apigw.LambdaRestApi(this, "EndpointPreSignS3", {
      handler: presignS3URLFn,
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
          RESIZED_BUCKET: resizedBucket.bucketName,
        },
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

    uploadBucket.grantPut(presignS3URLFn) // @chrisyeung1121
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