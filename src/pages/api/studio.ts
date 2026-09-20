import mongoose from 'mongoose';
// Ensure models are registered and the connection is open
import '@lib/models';
import { vercelAPIRouteHandler } from '@mongoosejs/studio/vercel';

export default vercelAPIRouteHandler(mongoose, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY, // required for auth
  // enable local AI providers for Chat tab
  openAIAPIKey: process.env.OPENAI_API_KEY,
});
