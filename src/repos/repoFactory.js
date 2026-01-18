import path from 'path';
import { JsonRepo } from './jsonRepo.js';

export function createRepoFromEnv(){
  const driver = process.env.STORAGE_DRIVER || 'json';
  if(driver === 'json'){
    const p = process.env.JSON_DB_PATH || './data/db.json';
    const dbPath = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    return new JsonRepo(dbPath);
  }
  // Postgres repo intentionally left as TODO for next step.
  // The API contract is already stable; swap repo implementation when you add DB.
  throw new Error(`Unsupported STORAGE_DRIVER: ${driver}. Use STORAGE_DRIVER=json for now.`);
}
