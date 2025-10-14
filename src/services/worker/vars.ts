import 'dotenv/config';
export const COLLECTION_NAME = process.env.AGENDA_COLLECTION || 'chronosJobs';
export const DB_NAME = process.env.AGENDA_DB_NAME || 'agenda';
