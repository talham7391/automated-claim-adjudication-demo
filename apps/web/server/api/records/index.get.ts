import { createDb, listRecords } from '@demo/db';
export default defineEventHandler(event => listRecords(createDb(bindings(event).DB)));
