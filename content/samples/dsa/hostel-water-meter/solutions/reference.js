const data = require("fs").readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);

// prefix[i] = litres used on days 1..i, so a range is one subtraction.
// Totals stay below 5 * 10^10, far inside the 2^53 a Number holds exactly.
function rangeTotals(litres, queries) {
  const prefix = new Array(litres.length + 1).fill(0);
  for (let i = 0; i < litres.length; i++) prefix[i + 1] = prefix[i] + litres[i];
  return queries.map(([l, r]) => prefix[r] - prefix[l - 1]);
}

let pos = 0;
const n = data[pos++];
const q = data[pos++];
const litres = data.slice(pos, pos + n);
pos += n;
const queries = [];
for (let k = 0; k < q; k++, pos += 2) queries.push([data[pos], data[pos + 1]]);
process.stdout.write(rangeTotals(litres, queries).join("\n") + "\n");
