import { deleteModel, modelNames } from 'mongoose';

/**
 * Delete existing model to prevent OverwriteModelError in watch mode in development.
 * @requires NODE_ENV='development'
 */
export function clearModelInDevelopment(modelName = '') {
  if (process.env.NODE_ENV === 'development' && modelNames().includes(modelName)) {
    deleteModel(modelName);
  }
}
