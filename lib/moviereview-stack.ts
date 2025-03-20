import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as custom from 'aws-cdk-lib/custom-resources';
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/moviereviews";
import * as apig from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class MoviereviewStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieid", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "reviewid", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });

    const getReviewByMovieIdFn = new lambdanode.NodejsFunction(
      this,
      "GetReviewByMovieFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: `${__dirname}/../lambdas/getReviewByMovieId.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const newMovieReviewFn = new lambdanode.NodejsFunction(this, "AddReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/addReview.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const updateMovieReviewFn = new lambdanode.NodejsFunction(this, "putMovieReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/putReview.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const getReviewTranslationFn = new lambdanode.NodejsFunction(this, "getReviewTranslationFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/getTranslation.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });


    new custom.AwsCustomResource(this, "moviereviewsddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviereviewsddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY, // Enable logging
    });

    // const getReviewByMovieIdURL = getReviewByMovieIdFn.addFunctionUrl({
    //   authType: lambda.FunctionUrlAuthType.NONE,
    //   cors: {
    //     allowedOrigins: ["*"],
    //   },
    // });

    movieReviewsTable.grantReadData(getReviewByMovieIdFn);   
    movieReviewsTable.grantReadWriteData(newMovieReviewFn);
    movieReviewsTable.grantReadWriteData(updateMovieReviewFn);



    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const movieReviewsEndpoint = api.root.addResource("movies");
    const movieAllReviews = movieReviewsEndpoint.addResource("reviews");
    const specificMovieReviews = movieAllReviews.addResource("{movieId}");
    specificMovieReviews.addMethod("GET", new apig.LambdaIntegration(getReviewByMovieIdFn, { proxy: true }));

    movieAllReviews.addMethod("POST",new apig.LambdaIntegration(newMovieReviewFn, { proxy: true }));

    const specificMovie = movieReviewsEndpoint.addResource("{movieid}");
    const movieReviewsEnd = specificMovie.addResource("reviews");
    const specificReviewMovie = movieReviewsEnd.addResource("{reviewid}");
    specificReviewMovie.addMethod("PUT",new apig.LambdaIntegration(updateMovieReviewFn, { proxy: true }));

    const reviewsEndpoint = api.root.addResource("reviews");
    const reviewTranslation = reviewsEndpoint
      .addResource("{reviewid}")
      .addResource("{movieid}")
      .addResource("translation");
    reviewTranslation.addMethod(
      "GET",
      new apig.LambdaIntegration(getReviewTranslationFn, { proxy: true })
    );

    
    getReviewTranslationFn.addToRolePolicy(new PolicyStatement({
      effect : Effect.ALLOW,
      resources : ["*"],
      actions: ["dynamodb:GetItem", "translate:TranslateText"]
    }))
  }
}