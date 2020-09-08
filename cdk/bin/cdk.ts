#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkStack } from '../lib/cdk-stack';

const app = new cdk.App();
new CdkStack(app, 'LearnCDKStack', {
  // stackName: 'learn-cdk-f02dad-c58ab3',
  env: {
    region: 'ap-east-1'
  }
});
