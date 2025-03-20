import { APIGatewayRequestAuthorizerHandler } from "aws-lambda";
import { CookieMap, createPolicy, parseCookies, verifyToken } from "../utils";

export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  console.log("[EVENT]", event);

  const cookies: CookieMap = parseCookies(event);

  if (!cookies) {
    return {
      principalId: "",
      policyDocument: createPolicy(event, "Deny"),
    };
  }

  const verifiedJwt = await verifyToken(
    cookies.token,
    'eu-west-1_5W7CBRKS7',
    'eu-west-1'
  );

  return {
    principalId: verifiedJwt ? verifiedJwt.sub!.toString() : "",
    policyDocument: createPolicy(event, verifiedJwt ? "Allow" : "Deny"),
  };
};
