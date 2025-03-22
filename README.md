## Enterprise Web Development module - Serverless REST Assignment.

__Name:__ Alex Benoy
__Demo:__ [https://youtu.be/xqAicoTgMqA](...)  

### Overview  

This repository contains a CDK stack that can be deployed to CloudFormation. The CDK app has authentication APIs, including:  

This reposiory has a CDK stack to be deployed to a CloudFormation. It has both App (REST) APIs, and authentication APIs.

The authentication APIs include SignUp, Confirm SignUp, SignIn and SignOut.
The REST APIs has the endpoits for :
- Retrieve reviews
- Add new reviews
- Update reviews
- Get translated movie reviews

### App-API endpoints  

- **GET** `/movie/reviews/{movieId}` - To retrieve reviews for a specified movie. It supports optional query parameters, reviewid or reviewerid (email)for getting specific reviews either by a reviewer or based on reiviewid. e.g. ?revieid=1234 or ?reviewerid=joe@gmail.com.
- **POST** `/movies/reviews` - To add new reviews. Requires user authentication.
- **GET** `reviews/{reviewId}/{movieId}/translation?language=code` - To get the translated vesion of a review content.
- **PUT** `/movies/{movieid}/reviews/{reviewid}` - Update a review for a specific movie. Only authenticated users can update a review. 

### Features  

#### Custom L2 Construct

##### Constructs used and input properties  

**AppApiConstruct Input Props:**  

```typescript
type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
}; 
```

**AuthApiConstruct Input Props:**  

```typescript
type AuthApiProps = {
  userPoolId: string;
  userPoolClientId: string;
}; 
```

```typescript
export class AuthApiConstruct extends Construct {  
  private auth: apig.IResource;  
  private userPoolId: string;  
  private userPoolClientId: string;  
}
```

#### Restricted Review Updates  

- Only existing users can use the PUT and POST APIs to add or update reviews. To access these features, you’ll need to include the Authorization token (which you get when you sign up) in the header of your API request.