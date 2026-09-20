import { deleteModel, getModelWithString } from '@typegoose/typegoose';

/**
 * Delete existing model to prevent OverwriteModelError in watch mode in development.
 * Uses typegoose's deleteModel, which clears both typegoose's internal cache and
 * mongoose's registry. Clearing only mongoose's copy leaves the typegoose cache
 * populated, so getModelForClass() returns the cached model without re-registering
 * it on the connection — connection.models ends up empty after a dev rebuild,
 * which breaks Mongoose Studio's model list.
 * @requires NODE_ENV='development'
 */
export function clearModelInDevelopment(modelName = '') {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  if (getModelWithString(modelName)) {
    deleteModel(modelName);
  }
}
