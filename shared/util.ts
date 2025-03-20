import { marshall } from "@aws-sdk/util-dynamodb";
import { MovieReview } from "./types";
// import { CognitoJwtVerifier } from "aws-jwt-verify";

type Entity = MovieReview;  // NEW
export const generateItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity),
    },
  };
};

export const generateBatch = (data: Entity[]) => {
  return data.map((e) => {
    return generateItem(e);
  });
};

// export const getFormattedDate = () => {
//   const date = new Date();
//   const day = String(date.getDate()).padStart(2, "0");
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const year = date.getFullYear();
//   return `${day}-${month}-${year}`;
// };

// export const JWTVerifier = CognitoJwtVerifier.create({
//   userPoolId: "eu-west-1_HC85F2kWT",
//   tokenUse: "id",
//   clientId: "4iqe2s2a613upgg70oqa68d6c5",
// });