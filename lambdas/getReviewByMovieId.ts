import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayEvent, APIGatewayEventRequestContext } from "aws-lambda";

const dynamoClient = new DynamoDBClient();

export const handler = async (event: APIGatewayEvent, context: APIGatewayEventRequestContext) => {
    // Check if pathParameters exists and movieId is present
    if (!event.pathParameters || !event.pathParameters["movieId"]) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Movie ID not present" })
        };
    }

    // Safely extract movieId from pathParameters
    const movieId = parseInt(event.pathParameters["movieId"], 10);
    if (isNaN(movieId)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid Movie ID" })
        };
    }

    // Define the DynamoDB query
    const queryCommandInput: QueryCommandInput = {
        TableName: "MovieReviews",
        KeyConditionExpression: "movieid = :movieid", // Use "movieid" (lowercase)
        ExpressionAttributeValues: {
            ":movieid": { N: movieId.toString() } // Ensure movieId is a number (N type)
        }
    };

    try {
        // Query DynamoDB
        const response = await dynamoClient.send(new QueryCommand(queryCommandInput));
        if (!response.Items || response.Items.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "No reviews found for this movie" })
            };
        }

        // Unmarshall the DynamoDB items
        const movies = response.Items.map(item => unmarshall(item));

        // Return the response
        return {
            statusCode: 200,
            body: JSON.stringify({ movies: movies })
        };
    } catch (error) {
        console.error("Error querying DynamoDB:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
};