import 'dotenv/config';
import { COLLECTION_NAMES } from '@lib/prisma/contract';

/**
 * @deprecated Use `COLLECTION_NAMES.tasks` from `@lib/prisma/contract` instead.
 * This used to be a variable settable from process.env.AGENDA_COLLECTION, but now we use the contract to define the collection name.
 */
export const COLLECTION_NAME = COLLECTION_NAMES.tasks;
export const DB_NAME = process.env.AGENDA_DB_NAME || 'agenda';
