import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));

    // Extract movieid and reviewid from path parameters
    const movieid = event.pathParameters?.movieid;
    const reviewid = event.pathParameters?.reviewid;

    if (!movieid || !reviewid) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing movieid or reviewid in path parameters" }),
      };
    }

    // Parse the request body
    const body = event.body ? JSON.parse(event.body) : undefined;
    if (!body) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing request body" }),
      };
    }

    // Extract reviewdate and content from the request body
    const { reviewdate, content } = body;

    if (!reviewdate || !content) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing reviewdate or content in request body" }),
      };
    }

    // Update the review in DynamoDB
    const commandOutput = await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          movieid: parseInt(movieid), // Convert to number if movieid is stored as a number
          reviewid: parseInt(reviewid), // Convert to number if reviewid is stored as a number
        },
        UpdateExpression: "SET reviewdate = :reviewdate, content = :content",
        ExpressionAttributeValues: {
          ":reviewdate": reviewdate,
          ":content": content,
        },
        ReturnValues: "UPDATED_NEW",
      })
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "Review updated", updatedAttributes: commandOutput.Attributes }),
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

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}