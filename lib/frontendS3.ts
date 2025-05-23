import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { Distribution, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";

export class FrontendStack extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: "movie-review-frontend-bucket",
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      websiteIndexDocument: "index.html",
    });

    new s3deploy.BucketDeployment(this, "DeplotWebsite", {
      sources: [s3deploy.Source.asset("./dist")],
      destinationBucket: siteBucket,
    });

    const distribution = new Distribution(this, "SiteDistribution", {
      defaultBehavior: {
        origin: new S3Origin(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
    });
    
    new CfnOutput(this, "clodfrnt", {
      value: distribution.distributionDomainName,
    });

    new CfnOutput(this, "WebsiteURL", {
      value: siteBucket.bucketWebsiteUrl,
    });
  }
}