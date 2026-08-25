'use strict';

/**
 * Read-only SQL validation, faithful port of
 * IFESS.Shared/IFESS.QueryGateway.Shared/Validation/ReadOnlyQueryValidator.cs.
 * Only `SELECT ...` and `WITH ... SELECT ...` are allowed; comments,
 * multi-statement SQL and write/DDL/transaction keywords are rejected.
 */

const BLOCKED_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'RECREATE',
  'EXECUTE', 'MERGE', 'TRUNCATE', 'GRANT', 'REVOKE', 'COMMIT',
  'ROLLBACK', 'SET', 'DECLARE',
];

export function validateReadOnlySql(queryText, maxQueryLength = 10000) {
  const errors = [];
  const query = (queryText ?? '').trim();

  if (query.length === 0) {
    return { valid: false, errors: ['Query text is required.'] };
  }
  if (maxQueryLength <= 0) {
    return { valid: false, errors: ['maxQueryLength must be greater than zero.'] };
  }
  if (query.length > maxQueryLength) {
    return { valid: false, errors: [`Query length exceeds limit of ${maxQueryLength} characters.`] };
  }
  if (containsCommentOutsideString(query)) {
    return { valid: false, errors: ['SQL comments are not allowed in Query Gateway statements.'] };
  }

  let inspect = stripStringLiterals(query).trim();
  if (!hasSingleOptionalTrailingSemicolon(inspect)) {
    return { valid: false, errors: ['Multiple SQL statements are not allowed.'] };
  }

  inspect = inspect.trimEnd();
  if (inspect.endsWith(';')) inspect = inspect.slice(0, -1).trimEnd();

  const firstToken = readFirstToken(inspect);
  const upper = firstToken.toUpperCase();
  if (upper !== 'SELECT' && upper !== 'WITH') {
    return { valid: false, errors: ['Only SELECT or WITH ... SELECT statements are allowed.'] };
  }
  if (upper === 'WITH' && !/\bSELECT\b/i.test(inspect)) {
    return { valid: false, errors: ['WITH statements must contain a SELECT query.'] };
  }

  for (const keyword of BLOCKED_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(inspect)) {
      return { valid: false, errors: [`${keyword} statement is not allowed.`] };
    }
  }

  return { valid: true, errors };
}

function hasSingleOptionalTrailingSemicolon(inspect) {
  let count = 0;
  for (const ch of inspect) if (ch === ';') count++;
  return count === 0 || (count === 1 && inspect.trimEnd().endsWith(';'));
}

function readFirstToken(inspect) {
  const match = /^\s*(\w+)/.exec(inspect);
  return match ? match[1] : '';
}

function stripStringLiterals(query) {
  let out = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    if (inSingle) {
      if (ch === '\'' && i + 1 < query.length && query[i + 1] === '\'') {
        out += ' ';
        out += ' ';
        i++;
        continue;
      }
      if (ch === '\'') inSingle = false;
      out += ' ';
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      out += ' ';
      continue;
    }
    if (ch === '\'') { inSingle = true; out += ' '; continue; }
    if (ch === '"') { inDouble = true; out += ' '; continue; }
    out += ch;
  }
  return out;
}

function containsCommentOutsideString(query) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    if (inSingle) {
      if (ch === '\'' && i + 1 < query.length && query[i + 1] === '\'') { i++; continue; }
      if (ch === '\'') inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      continue;
    }
    if (ch === '\'') { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '-' && query[i + 1] === '-') return true;
    if (ch === '/' && query[i + 1] === '*') return true;
  }
  return false;
}
