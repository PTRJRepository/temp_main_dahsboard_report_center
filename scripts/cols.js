const http = require("http");
const table = process.argv[2];
const sql = `SELECT RDB$FIELD_NAME, RDB$FIELD_POSITION FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='${table}' ORDER BY RDB$FIELD_POSITION`;
const data = JSON.stringify({ queryText: sql, maxRows: 100 });
const req = http.request({
  hostname: "localhost", port: 3002, path: "/api/query-gateway/exec-sync", method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
}, res => {
  let b = "";
  res.on("data", c => b += c);
  res.on("end", () => {
    try {
      const j = JSON.parse(b);
      console.log("status " + res.statusCode + " rowCount " + j.rowCount);
      if (j.rows) j.rows.forEach(r => console.log(r[1] + "\t" + r[0]));
      if (j.error || j.message) console.log("error " + (j.error || j.message));
    } catch (e) { console.log("RAW: " + b.slice(0, 3000)); }
  });
});
req.on("error", e => console.log("ERR: " + e.message));
req.write(data); req.end();
