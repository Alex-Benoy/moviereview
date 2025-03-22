import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MovieReview } from "../shared/types";

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
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Invalid or missing Movie ID" }),
            };
        }

        // Define the DynamoDB query
        const queryCommandInput: QueryCommandInput = {
            TableName: "MovieReviews",
            KeyConditionExpression: "movieid = :movieid",
            ExpressionAttributeValues: {
                ":movieid": { N: movieId.toString() },
            },
        };

        // Query DynamoDB
        const response = await dynamoClient.send(new QueryCommand(queryCommandInput));

        if (!response.Items || response.Items.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "No reviews found for this movie" }),
            };
        }

        // Unmarshall ;the DynamoDB items
        const reviews: MovieReview[] = response.Items.map((item) => unmarshall(item) as MovieReview);

        let items = reviews
        if (event.queryStringParameters) {
            if (event.queryStringParameters["reviewid"]) {
                const reviewid = event.queryStringParameters["reviewid"]
                items = items.filter(review => review.reviewid == parseInt(reviewid))
            }
            if (event.queryStringParameters["reviewerid"]) {
                const reviewerid = event.queryStringParameters["reviewerid"]
                items = items.filter(review => review.reviwerid == reviewerid)
            }

        }
        // Return the response
        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ items }),
        };
    } catch (error) {
        console.error("Error querying DynamoDB:", error);
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
};