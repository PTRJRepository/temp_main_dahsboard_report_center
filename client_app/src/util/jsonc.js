'use strict';

/**
 * Parse JSON with // and block comments allowed outside strings
 * (mirrors how IFESS.SuperApp reads appsettings.json with comments).
 */
export function parseJsonC(text) {
  const stripped = stripComments(text);
  return JSON.parse(stripped);
}

function stripComments(text) {
  let out = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inSingle) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i++; }
      else if (ch === '\'') inSingle = false;
      continue;
    }
    if (inDouble) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i++; }
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (ch === '\'' ) { inSingle = true; out += ch; continue; }
    if (ch === '"' ) { inDouble = true; out += ch; continue; }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++; // skip trailing '/'
      continue;
    }
    out += ch;
  }
  return out;
}
