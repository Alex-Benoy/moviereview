import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SignUpBody } from "../../shared/types";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  SignUpCommandInput,
} from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import

const client = new CognitoIdentityProviderClient({ region:  process.env.REGION  });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[EVENT]",JSON.stringify(event));
    const body = event.body ? JSON.parse(event.body) : undefined;


    const signUpBody = body as SignUpBody;

    const params: SignUpCommandInput = {
      ClientId: process.env.CLIENT_ID!,
      Username: signUpBody.username,
      Password: signUpBody.password,
      UserAttributes: [{ Name: "email", Value: signUpBody.email }],
    };

    const command = new SignUpCommand(params);
    const res = await client.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: res,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: err,
      }),
    };
  }
};
