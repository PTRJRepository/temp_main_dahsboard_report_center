const http = require("http");
const q = process.argv[2];
const max = process.argv[3] || 100;
const data = JSON.stringify({ queryText: q, maxRows: Number(max) });
const req = http.request({
  hostname: "localhost", port: 3001, path: "/api/query-gateway/exec-sync", method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
}, res => {
  let b = "";
  res.on("data", c => b += c);
  res.on("end", () => {
    try {
      const j = JSON.parse(b);
      console.log("status " + res.statusCode);
      console.log("success " + j.success + " rowCount " + j.rowCount);
      console.log("headers " + JSON.stringify(j.headers));
      console.log("rows " + JSON.stringify(j.rows));
      if (j.error || j.message) console.log("error " + (j.error || j.message));
    } catch (e) { console.log("RAW: " + b.slice(0, 2000)); }
  });
});
req.on("error", e => console.log("ERR: " + e.message));
req.write(data); req.end();
