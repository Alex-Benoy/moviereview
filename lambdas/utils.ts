import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerEvent,
  PolicyDocument,
  APIGatewayProxyEvent,
  StatementEffect,
} from "aws-lambda";

import axios from "axios";
import jwt from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";

export type CookieMap = { [key: string]: string } | undefined;
export type JwtToken = { sub: string; email: string } | null;
export type Jwk = {
  keys: {
    alg: string;
    e: string;
    kid: string;
    kty: string;
    n: string;
    use: string;
  }[];
};

export const parseCookies = (
  event: APIGatewayRequestAuthorizerEvent | APIGatewayProxyEvent
): CookieMap => {
  if (!event.headers || !event.headers.Cookie) {
    return undefined;
  }

  const cookiesStr = event.headers.Cookie;
  const cookiesArr = cookiesStr.split(";");

  const cookieMap: CookieMap = {};

  for (let cookie of cookiesArr) {
    const cookieSplit = cookie.trim().split("=");
    cookieMap[cookieSplit[0]] = cookieSplit[1];
  }

  return cookieMap;
};

export const verifyToken = async (
  token: string,
  userPoolId?: string,
  region?: string
): Promise<JwtToken> => {
  try {
    // Retrieve userPoolId and region from environment variables if not provided
    const resolvedUserPoolId = userPoolId || process.env.COGNITO_USER_POOL_ID;
    const resolvedRegion = region || process.env.AWS_REGION;

    // Validate required parameters
    if (!resolvedUserPoolId || !resolvedRegion) {
      throw new Error("userPoolId and region are required");
    }

    const url = `https://cognito-idp.${resolvedRegion}.amazonaws.com/${resolvedUserPoolId}/.well-known/jwks.json`;
    const { data }: { data: Jwk } = await axios.get(url);

    if (!data.keys || data.keys.length === 0) {
      throw new Error("No keys found in JWKS");
    }

    const pem = jwkToPem(data.keys[0]);
    const decodedToken = jwt.verify(token, pem, { algorithms: ["RS256"] });

    return decodedToken as JwtToken;
  } catch (err) {
    console.error("Token verification failed:", err);
    return null;
  }
};

export const createPolicy = (
  event: APIGatewayAuthorizerEvent,
  effect: StatementEffect
): PolicyDocument => {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: effect,
        Action: "execute-api:Invoke",
        Resource: [event.methodArn],
      },
    ],
  };
};