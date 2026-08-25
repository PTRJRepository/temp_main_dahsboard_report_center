'use strict';

/**
 * Builds result/chunk envelopes and sends them to the control server,
 * port of QueryResultReporter.cs + QueryResultFormatter.cs.
 *
 * Inline mode  -> POST api/query-gateway/jobs/{id}/result   (Success/Failed/Rejected/Timeout)
 * Chunked mode -> POST api/query-gateway/jobs/{id}/chunks   (chunkIndex mulai 1, isLastChunk di akhir)
 */

export class QueryResultReporter {
  constructor(client, controlServerOptions) {
    this.client = client;
    this.clientId = controlServerOptions.clientId;
    this.baseQuery = {
      queryBatchId: '',
      queryJobId: '',
      clientId: controlServerOptions.clientId,
    };
  }

  createSuccessEnvelopes(payload, result, startedAtIso, finishedAtIso) {
    const rows = formatRows(result);
    const chunkSize = Math.max(1, Number(payload.chunkSize ?? 500));
    const chunked = String(payload.resultMode ?? 'Inline').toLowerCase() === 'chunked' || rows.length > chunkSize;

    if (chunked) {
      const envelopes = [];
      for (let index = 0; index < rows.length; index += chunkSize) {
        const chunkRows = rows.slice(index, index + chunkSize);
        envelopes.push(chunkEnvelope(this, payload, {
          chunkIndex: index / chunkSize + 1,
          isLastChunk: index + chunkSize >= rows.length,
          headers: result.headers,
          rows: chunkRows,
        }));
      }
      if (rows.length === 0) {
        // Zero-row success still needs a final empty chunk carrying the headers.
        envelopes.push(chunkEnvelope(this, payload, {
          chunkIndex: 1,
          isLastChunk: true,
          headers: result.headers,
          rows: [],
        }));
      }
      return envelopes;
    }

    return [resultEnvelope(this, payload, {
      status: 'Success',
      headers: result.headers,
      rows,
      rowCount: result.rowCount,
      isTruncated: result.isTruncated,
      executionTimeMs: result.executionTimeMs,
      startedAt: startedAtIso,
      finishedAt: finishedAtIso,
    })];
  }

  createFailureEnvelope(payload, status, message) {
    return resultEnvelope(this, payload, {
      status,
      headers: [],
      rows: [],
      rowCount: 0,
      isTruncated: false,
      executionTimeMs: 0,
      finishedAt: new Date().toISOString(),
      errorMessage: message || null,
    });
  }

  async send(envelopes) {
    for (const envelope of envelopes) {
      if (envelope.kind === 'Chunk') {
        await this.client.reportQueryChunk(envelope.queryJobId, envelope.chunk);
      } else {
        await this.client.reportQueryResult(envelope.queryJobId, envelope.result);
      }
    }
  }
}

function resultEnvelope(reporter, payload, fields) {
  return {
    envelopeId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    kind: 'Result',
    queryJobId: payload.queryJobId,
    result: {
      ...reporter.baseQuery,
      queryBatchId: payload.queryBatchId ?? '',
      queryJobId: payload.queryJobId ?? '',
      ...fields,
    },
  };
}

function chunkEnvelope(reporter, payload, fields) {
  return {
    envelopeId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    kind: 'Chunk',
    queryJobId: payload.queryJobId,
    chunk: {
      ...reporter.baseQuery,
      queryBatchId: payload.queryBatchId ?? '',
      queryJobId: payload.queryJobId ?? '',
      ...fields,
    },
  };
}

/** Formatter converts parser values into JSON-safe row objects. */
export function formatRows(result) {
  return (result.rows ?? []).map(row => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) { out[key] = null; continue; }
      if (value instanceof Date) { out[key] = value.toISOString(); continue; }
      if (typeof value === 'object') { out[key] = JSON.stringify(value); continue; }
      out[key] = value;
    }
    return out;
  });
}
