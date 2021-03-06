import { r } from "src/server/models/thinky";
import humps from "humps";
// Knex instance used by the db package, just an alias for thinky's connection
// for now.
// TODO[matteo]: maybe split out the connection and add post processing:
//   http://knexjs.org/#Installation-post-process-response
const knex = r.knex;

async function transaction(fn) {
  return knex.transaction(fn);
}

/**
 * Run a block of code, creating a new transaction if one isn't passed
 *
 * @param opts with nullable knex transaction object
 * @param fn async function that takes a modified opts object as its only argument
 * @return {Promise<*>}
 */
async function withTransaction(opts, fn) {
  if (opts && opts.transaction) {
    return fn(opts);
  }
  return transaction(trx => fn({ ...opts, transaction: trx }));
}

function queryBuilder(tableName, opts) {
  const trx = opts && opts.transaction;
  const builder = trx ? trx(tableName) : r.knex(tableName);
  if (opts && opts.forUpdate) {
    return builder.forUpdate();
  }
  return builder;
}

function camelize(obj) {
  return humps.camelizeKeys(obj, { separator: "_" });
}

function decamelize(obj) {
  return humps.decamelizeKeys(obj, { separator: "_" });
}

function convertCase(obj, opts) {
  return opts && opts.snakeCase ? obj : camelize(obj);
}

function convertCaseFirst(aryOfObj, opts) {
  if (aryOfObj.length === 0) {
    return null;
  }

  return convertCase(aryOfObj[0], opts);
}

// Generic get function
async function getAny(tableName, fieldName, fieldValue, opts = {}) {
  const result = await queryBuilder(tableName, opts)
    .where(fieldName, fieldValue)
    .first();

  return convertCase(result, opts);
}

async function genericGetMany(tableName, fieldName, fieldValues, opts = {}) {
  const result = await queryBuilder(tableName, opts)
    .whereIn(fieldName, fieldValues)
    .first();

  return convertCase(result, opts);
}

async function genericList(tableName, where = null, opts = {}) {
  const result = await queryBuilder(tableName, opts).where(where);
  return convertCase(result, opts);
}

async function insertAndReturn(tableName, fields, opts) {
  return convertCaseFirst(
    await queryBuilder(tableName, opts)
      .insert(decamelize(fields))
      .returning("*"),
    opts
  );
}

async function bulkInsert(tableName, rows, opts) {
  const trx = opts && opts.transaction;

  let batch = knex.batchInsert(
    tableName,
    rows.map(decamelize),
    opts.chunkSize || 1000
  );

  if (trx) {
    batch = batch.transacting(trx);
  }

  return batch.returning("*");
}

async function updateAndReturn(tableName, id, fields, opts) {
  return convertCaseFirst(
    await queryBuilder(tableName, opts)
      .where({
        id
      })
      .update(decamelize(fields))
      .returning("*"),
    opts
  );
}

const Table = {
  ASSIGNMENT: "assignment",
  BACKGROUND_JOB: "background_job",
  CAMPAIGN: "campaign",
  CAMPAIGN_CONTACT: "campaign_contact",
  CANNED_RESPONSE: "canned_response",
  CANNED_RESPONSE_LABEL: "canned_response_label",
  INTERACTION_STEP: "interaction_step",
  JOB_REQUEST: "job_request",
  LABEL: "label",
  MESSAGE: "message",
  NOTIFICATION: "notification",
  OPT_OUT: "opt_out",
  ORGANIZATION: "organization",
  QUESTION_RESPONSE: "question_response",
  TAG: "tag",
  TWILIO_PHONE_NUMBER: "twilio_phone_number",
  USER: "user",
  USER_ORGANIZATION: "user_organization",
  ZIP_CODE: "zip_code" // unused but will take some work to get rid of
};

export {
  queryBuilder,
  Table,
  knex,
  getAny,
  genericGetMany,
  genericList,
  camelize,
  decamelize,
  transaction,
  withTransaction,
  insertAndReturn,
  updateAndReturn,
  convertCase,
  bulkInsert
};
