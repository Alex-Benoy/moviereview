import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";

const ddbClient = new DynamoDBClient()
const translateClient = new TranslateClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));

    // Extract movieid, reviewid, and language code from path parameters and query string
    const movieid = event.pathParameters?.movieid;
    const reviewid = event.pathParameters?.reviewid;
    const languageCode = event.queryStringParameters?.language || "en"; 

    if (!movieid || !reviewid) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing movieid or reviewid in path parameters" }),
      };
    }

    // Fetch the review content from DynamoDB
    const commandOutput = await ddbClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          movieid: parseInt(movieid), 
          reviewid: parseInt(reviewid), 
        },
      })
    );

    if (!commandOutput.Item) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Review not found" }),
      };
    }

    const reviewContent = commandOutput.Item.content;

    // Translate the review content using AWS Translate
    const translateParams = {
      Text: reviewContent,
      SourceLanguageCode: "en",
      TargetLanguageCode: languageCode,
    };

    const translateResponse = await translateClient.send(new TranslateTextCommand(translateParams));

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Review translated successfully",
        translatedContent: translateResponse.TranslatedText,
      }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

