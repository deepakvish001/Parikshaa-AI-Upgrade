import { describe, expect, it } from "vitest";
import { sqlRows, sqlTables } from "./sql-view.ts";

describe("SQL as tables", () => {
  it("reads a setup script back as its tables, columns and rows", () => {
    const setup = `CREATE TABLE World (name TEXT PRIMARY KEY, continent TEXT, area INTEGER, population INTEGER);
INSERT INTO World (name, continent, area, population) VALUES ('India', 'Asia', 3287263, 1428627663), ('Cote d''Ivoire', 'Africa', 322463, NULL);
CREATE TABLE Orders (id INTEGER, customer_id INTEGER, PRIMARY KEY (id), FOREIGN KEY (customer_id) REFERENCES Customers (id));
INSERT INTO Orders VALUES (1, 7);`;
    expect(sqlTables(setup)).toEqual([
      {
        name: "World",
        columns: [
          { name: "name", type: "TEXT" },
          { name: "continent", type: "TEXT" },
          { name: "area", type: "INTEGER" },
          { name: "population", type: "INTEGER" },
        ],
        rows: [
          ["India", "Asia", "3287263", "1428627663"],
          ["Cote d'Ivoire", "Africa", "322463", "NULL"],
        ],
      },
      {
        name: "Orders",
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "customer_id", type: "INTEGER" },
        ],
        rows: [["1", "7"]],
      },
    ]);
  });

  it("puts named columns in the table's order, and leaves what it cannot read", () => {
    const tables = sqlTables("CREATE TABLE t (a INT, b TEXT); INSERT INTO t (b, a) VALUES ('x;y', 2); DROP TABLE nothing; INSERT INTO missing VALUES (1);");
    expect(tables).toEqual([{ name: "t", columns: [{ name: "a", type: "INT" }, { name: "b", type: "TEXT" }], rows: [["2", "x;y"]] }]);
    expect(sqlTables("not sql at all")).toEqual([]);
  });

  it("splits the runner's output into rows and columns", () => {
    expect(sqlRows("India\t1428627663\nNepal\tNULL\n")).toEqual([
      ["India", "1428627663"],
      ["Nepal", "NULL"],
    ]);
    expect(sqlRows("")).toEqual([]);
  });
});
