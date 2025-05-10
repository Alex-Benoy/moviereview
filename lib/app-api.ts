import { Aws } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/moviereviews";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
};

export class AppApi extends Construct {
  constructor(scope: Construct, id: string, props: AppApiProps) {
    super(scope, id);

    // DynamoDB Table for Movie Reviews
    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieid", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "reviewid", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });

    //table for frontend
     const reviewsTable = new dynamodb.Table(this, "FrontendReviewsTable", {
        partitionKey: { name: "ReviewId", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        tableName: "FrontendReviewsTable",
         // Change to RETAIN for production
      });

    // Common Lambda Function Props
    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    // Create the postMovieReviews Lambda function
    const addFrontendReview = new node.NodejsFunction(this, "AddFrontendReview", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/reviewPost.ts` ,
      environment: {
        REVIEWS_TABLE_NAME: reviewsTable.tableName, // Set the table name as an environment variable
      },
    });

    const retrieveMovieReviews = new node.NodejsFunction(this, "retrieveMovieReviews", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/reviewGet.ts`,
      environment: {
        REVIEWS_TABLE_NAME: reviewsTable.tableName,
      },
    });

    // Lambda Functions for retrieving Movie Reviews
    const getReviewByMovieIdFn = new node.NodejsFunction(this, "GetReviewByMovieFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/getReviewByMovieId.ts`,
      environment: {
        ...appCommonFnProps.environment,
        TABLE_NAME: movieReviewsTable.tableName,
      },
    });

    const newMovieReviewFn = new node.NodejsFunction(this, "AddReviewFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/addReview.ts`,
      environment: {
        ...appCommonFnProps.environment,
        TABLE_NAME: movieReviewsTable.tableName,
      },
    });

    const updateMovieReviewFn = new node.NodejsFunction(this, "putMovieReviewFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/putReview.ts`,
      environment: {
        ...appCommonFnProps.environment,
        TABLE_NAME: movieReviewsTable.tableName,
      },
    });

    const getReviewTranslationFn = new node.NodejsFunction(this, "getReviewTranslationFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/getTranslation.ts`,
      environment: {
        ...appCommonFnProps.environment,
        TABLE_NAME: movieReviewsTable.tableName,
      },
    });

    // Initialize DynamoDB with Movie Reviews Data
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
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY, 
    });

    // Grant permissions to Lambda functions
    movieReviewsTable.grantReadData(getReviewByMovieIdFn);
    movieReviewsTable.grantReadWriteData(newMovieReviewFn);
    movieReviewsTable.grantReadWriteData(updateMovieReviewFn);
    reviewsTable.grantWriteData(addFrontendReview);
    reviewsTable.grantReadData(retrieveMovieReviews);

    // API Gateway
    const appApi = new apig.RestApi(this, "AppApi", {
      description: "App RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        // allowOrigins: ["*"],
      },
    });

    // Protected and Public Resources
    const protectedRes = appApi.root.addResource("protected");
    const publicRes = appApi.root.addResource("public");

    // Protected and Public Lambda Functions
    const protectedFn = new node.NodejsFunction(this, "ProtectedFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/protected.ts",
    });

    const publicFn = new node.NodejsFunction(this, "PublicFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/public.ts",
    });

    const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/authorizer.ts",
    });

    // Request Authorizer
    const requestAuthorizer = new apig.RequestAuthorizer(this, "RequestAuthorizer", {
      identitySources: [apig.IdentitySource.header("cookie")],
      handler: authorizerFn,
      resultsCacheTtl: cdk.Duration.minutes(0),
    });

    // Protected Endpoint
    protectedRes.addMethod("GET", new apig.LambdaIntegration(protectedFn), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

    // Public Endpoint
    publicRes.addMethod("GET", new apig.LambdaIntegration(publicFn));

    // Movie Reviews Endpoints
    const movieReviewsEndpoint = appApi.root.addResource("movies");
    const movieAllReviews = movieReviewsEndpoint.addResource("reviews");
    const specificMovieReviews = movieAllReviews.addResource("{movieId}");
    specificMovieReviews.addMethod("GET", new apig.LambdaIntegration(getReviewByMovieIdFn, { proxy: true }));

    movieAllReviews.addMethod("POST", new apig.LambdaIntegration(newMovieReviewFn, { proxy: true }),{authorizer:requestAuthorizer,authorizationType:apig.AuthorizationType.CUSTOM});

    const specificMovie = movieReviewsEndpoint.addResource("{movieid}");
    const movieReviewsEnd = specificMovie.addResource("reviews");
    const specificReviewMovie = movieReviewsEnd.addResource("{reviewid}");
    const reviewsResource = appApi.root.addResource("frontendreviews");
    specificReviewMovie.addMethod("PUT", new apig.LambdaIntegration(updateMovieReviewFn, { proxy: true }),{authorizer:requestAuthorizer,authorizationType:apig.AuthorizationType.CUSTOM});

    const reviewsEndpoint = appApi.root.addResource("reviews");
    const reviewTranslation = reviewsEndpoint
      .addResource("{reviewid}")
      .addResource("{movieid}")
      .addResource("translation");
    reviewTranslation.addMethod(
      "GET",
      new apig.LambdaIntegration(getReviewTranslationFn, { proxy: true })
    );

    // Add the POST method to the /reviews resource
          reviewsResource.addMethod(
            "POST",
            new apig.LambdaIntegration(addFrontendReview, { proxy: true })
          );
    // Add the GET method to the /reviews resource
          reviewsEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(retrieveMovieReviews, { proxy: true }));

    //Translation Lambda Function permissions
    getReviewTranslationFn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ["*"],
      actions: ["dynamodb:GetItem", "translate:TranslateText"]
    }));
  }
}