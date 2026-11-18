const data = require("fs").readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);

// litres[i] is day i + 1; each query is [l, r], 1-indexed and inclusive.
// Return one total per query, in order.
function rangeTotals(litres, queries) {
  // TODO: your code here
  return queries.map(() => 0);
}

let pos = 0;
const n = data[pos++];
const q = data[pos++];
const litres = data.slice(pos, pos + n);
pos += n;
const queries = [];
for (let k = 0; k < q; k++, pos += 2) queries.push([data[pos], data[pos + 1]]);
process.stdout.write(rangeTotals(litres, queries).join("\n") + "\n");
