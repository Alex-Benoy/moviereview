import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

const dynamoClient = new DynamoDBClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));

        // Safely extract movieId from pathParameters
        const pathParameters = event?.pathParameters;
        const movieId = pathParameters?.movieId ? parseInt(pathParameters.movieId, 10) : undefined;

        if (!movieId || isNaN(movieId)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid or missing Movie ID" })
            };
        }

        // Define the DynamoDB query
        const queryCommandInput: QueryCommandInput = {
            TableName: "MovieReviews",
            KeyConditionExpression: "movieid = :movieid", 
            ExpressionAttributeValues: {
                ":movieid": { N: movieId.toString() } 
            }
        };

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