'use strict';

/**
 * Query parameter materializer, port of
 * IFESS.Shared/IFESS.QueryGateway.Shared/Validation/QueryParameterMaterializer.cs.
 *
 * Supports `:name` and `{{name}}` placeholders outside string literals.
 * Parameter values arrive from the server as:
 *   { name, value, type }  or  [{name, value, type}, ...]
 *   or map form { itemNo: { value, type }, ... }
 * Types: string (default), int/integer/long, decimal/number/numeric,
 * bool/boolean, date, timestamp/datetime.
 */

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
// Desimal ketat: tolak hex ('0x10'), 'Infinity', 'NaN' — paritas dengan
// decimal.TryParse InvariantCulture di sisi .NET.
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function materializeParameters(queryText, parameters, maxParameters = 50) {
  const list = normalizeParameterList(parameters);
  const errors = [];
  if (list.length > maxParameters) {
    errors.push(`Parameter count exceeds ${maxParameters}.`);
  }

  const map = new Map();
  for (const parameter of list) {
    const name = normalizeName(parameter.name);
    if (!name || !NAME_PATTERN.test(name)) {
      errors.push(`Parameter name '${parameter.name}' is invalid. Use letters, numbers, and underscore, starting with a letter or underscore.`);
      continue;
    }
    if (map.has(name.toLowerCase())) {
      errors.push(`Duplicate parameter '${name}'.`);
      continue;
    }
    map.set(name.toLowerCase(), parameter);
  }

  if (errors.length > 0) return { queryText, errors, success: false };

  const used = new Set();
  let out = '';
  for (let i = 0; i < queryText.length; i++) {
    const current = queryText[i];
    if (current === '\'') {
      i = copyQuotedString(queryText, i, part => { out += part; });
      continue;
    }
    if (current === '{' && queryText[i + 1] === '{') {
      const end = queryText.indexOf('}}', i + 2);
      if (end > i) {
        const name = normalizeName(queryText.slice(i + 2, end));
        if (!appendLiteral(part => { out += part; }, map, used, name, errors)) {
          out += queryText.slice(i, end + 2);
        }
        i = end + 1;
        continue;
      }
    }
    if (current === ':' && isNameStart(queryText[i + 1])) {
      const nameStart = i + 1;
      let nameEnd = nameStart + 1;
      while (nameEnd < queryText.length && isNameCharacter(queryText[nameEnd])) nameEnd++;
      const name = queryText.slice(nameStart, nameEnd);
      if (!appendLiteral(part => { out += part; }, map, used, name, errors)) {
        out += `:${name}`;
      }
      i = nameEnd - 1;
      continue;
    }
    out += current;
  }

  return errors.length === 0
    ? { queryText: out, errors: [], success: true }
    : { queryText, errors, success: false };
}

function normalizeParameterList(parameters) {
  if (!parameters) return [];
  if (Array.isArray(parameters)) return parameters.filter(Boolean);
  if (typeof parameters === 'object') {
    return Object.entries(parameters).map(([name, spec]) => ({
      name,
      value: spec?.value,
      type: spec?.type,
    }));
  }
  return [];
}

function copyQuotedString(text, startIndex, append) {
  append(text[startIndex]);
  for (let i = startIndex + 1; i < text.length; i++) {
    append(text[i]);
    if (text[i] !== '\'') continue;
    if (i + 1 < text.length && text[i + 1] === '\'') {
      i++;
      append(text[i]);
      continue;
    }
    return i;
  }
  return text.length - 1;
}

function appendLiteral(append, map, used, name, errors) {
  if (!NAME_PATTERN.test(name)) {
    errors.push(`Parameter placeholder '${name}' is invalid.`);
    return false;
  }
  const parameter = map.get(name.toLowerCase());
  if (!parameter) {
    errors.push(`Parameter '${name}' is required by query text but was not supplied.`);
    return false;
  }
  used.add(name.toLowerCase());
  try {
    append(toSqlLiteral(parameter));
  } catch (err) {
    errors.push(err.message);
  }
  return true;
}

function toSqlLiteral(parameter) {
  const type = String(parameter.type ?? '').trim().toLowerCase();
  const value = parameter.value;
  if (value === null || value === undefined) return 'NULL';

  switch (type) {
    case 'int':
    case 'integer':
    case 'long': {
      const text = getString(value);
      if (!/^[+-]?\d+$/.test(text.trim())) throw new Error(`Parameter value '${text}' is not a valid integer.`);
      return String(BigInt(text.trim()));
    }
    case 'decimal':
    case 'number':
    case 'numeric': {
      const text = getString(value).trim();
      if (!DECIMAL_PATTERN.test(text) || !Number.isFinite(Number(text))) {
        throw new Error(`Parameter value '${text}' is not a valid decimal.`);
      }
      return text;
    }
    case 'bool':
    case 'boolean': {
      if (value === true) return '1';
      if (value === false) return '0';
      const text = getString(value).trim().toLowerCase();
      if (text === 'true') return '1';
      if (text === 'false') return '0';
      throw new Error('Parameter value is not a valid boolean.');
    }
    case 'date':
      return `DATE '${escapeString(getString(value))}'`;
    case 'timestamp':
    case 'datetime':
      return `TIMESTAMP '${escapeString(getString(value))}'`;
    default:
      break;
  }

  if (value === true) return '1';
  if (value === false) return '0';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return `'${escapeString(getString(value))}'`;
}

function getString(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeString(value) {
  return String(value).split('\'').join('\'\'');
}

function normalizeName(name) {
  return String(name ?? '').trim().replace(/^:/, '').replace(/^[{]+|[}]+$/g, '').trim();
}

function isNameStart(ch) {
  return /[A-Za-z_]/.test(ch ?? '');
}

function isNameCharacter(ch) {
  return /[A-Za-z0-9_]/.test(ch ?? '');
}
