// SQL problems written for Parikshaa. Each test's expected output is what `reference` prints on its
// tables; content.test.ts runs every reference through the runner to keep it so.
import type { SqlPack } from "./packs.js";

export const SQL_STARTER: SqlPack = {
  "problems": [
    {
      "slug": "big-countries",
      "title": "Big countries",
      "difficulty": "easy",
      "tags": [
        "sql",
        "filtering"
      ],
      "stem": "A country is **big** when its area is at least 3,000,000 km² *or* its population is at least 25,000,000.\n\nTable `World(name TEXT, continent TEXT, area INTEGER, population INTEGER)`.\n\nReturn the `name`, `population` and `area` of every big country, in any order.",
      "tests": [
        {
          "id": "t1",
          "input": "CREATE TABLE World (name TEXT PRIMARY KEY, continent TEXT, area INTEGER, population INTEGER);\nINSERT INTO World (name, continent, area, population) VALUES ('India', 'Asia', 3287263, 1428627663), ('Nepal', 'Asia', 147516, 30896590), ('Bhutan', 'Asia', 38394, 787424), ('Canada', 'America', 9984670, 38781291);\n",
          "expected": "India\t1428627663\t3287263\nNepal\t30896590\t147516\nCanada\t38781291\t9984670\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "t2",
          "input": "CREATE TABLE World (name TEXT PRIMARY KEY, continent TEXT, area INTEGER, population INTEGER);\nINSERT INTO World (name, continent, area, population) VALUES ('Iceland', 'Europe', 103000, 372520), ('Malta', 'Europe', 316, 535064);\n",
          "expected": "",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t3",
          "input": "CREATE TABLE World (name TEXT PRIMARY KEY, continent TEXT, area INTEGER, population INTEGER);\nINSERT INTO World (name, continent, area, population) VALUES ('Australia', 'Oceania', 7692024, 26439111), ('Chile', 'America', 756102, 19629590), ('Kenya', 'Africa', 580367, 55100586), ('Edge', 'Nowhere', 3000000, 25000000);\n",
          "expected": "Australia\t26439111\t7692024\nKenya\t55100586\t580367\nEdge\t25000000\t3000000\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "ordered": false,
      "reference": "SELECT name, population, area FROM World WHERE area >= 3000000 OR population >= 25000000;",
      "editorial": "## Brute force\nRead each row and keep it when either condition holds: `WHERE area >= 3000000 OR population >= 25000000`.\n\n## Optimal: UNION of two index scans\nOn a large table with an index on each column, `OR` can stop either index being used. Two queries joined with `UNION` let each use its own:\n\n```sql\nSELECT name, population, area FROM World WHERE area >= 3000000\nUNION\nSELECT name, population, area FROM World WHERE population >= 25000000;\n```\n`UNION` (not `UNION ALL`) removes a country that meets both."
    },
    {
      "slug": "low-fat-and-recyclable",
      "title": "Low fat and recyclable",
      "difficulty": "easy",
      "tags": [
        "sql",
        "filtering"
      ],
      "stem": "Table `Products(product_id INTEGER, low_fats TEXT, recyclable TEXT)`; the flags are `'Y'` or `'N'`.\n\nReturn the `product_id` of every product that is both low fat and recyclable, in any order.",
      "tests": [
        {
          "id": "t1",
          "input": "CREATE TABLE Products (product_id INTEGER PRIMARY KEY, low_fats TEXT CHECK (low_fats IN ('Y','N')), recyclable TEXT CHECK (recyclable IN ('Y','N')));\nINSERT INTO Products (product_id, low_fats, recyclable) VALUES (0, 'Y', 'N'), (1, 'Y', 'Y'), (2, 'N', 'Y'), (3, 'Y', 'Y'), (4, 'N', 'N');\n",
          "expected": "1\n3\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "t2",
          "input": "CREATE TABLE Products (product_id INTEGER PRIMARY KEY, low_fats TEXT CHECK (low_fats IN ('Y','N')), recyclable TEXT CHECK (recyclable IN ('Y','N')));\nINSERT INTO Products (product_id, low_fats, recyclable) VALUES (10, 'N', 'N'), (11, 'N', 'Y');\n",
          "expected": "",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t3",
          "input": "CREATE TABLE Products (product_id INTEGER PRIMARY KEY, low_fats TEXT CHECK (low_fats IN ('Y','N')), recyclable TEXT CHECK (recyclable IN ('Y','N')));\nINSERT INTO Products (product_id, low_fats, recyclable) VALUES (1, 'N', 'N'), (2, 'Y', 'N'), (3, 'N', 'Y'), (4, 'Y', 'N'), (5, 'N', 'N'), (6, 'Y', 'Y'), (7, 'N', 'N'), (8, 'Y', 'N'), (9, 'N', 'Y'), (10, 'Y', 'N'), (11, 'N', 'N'), (12, 'Y', 'Y'), (13, 'N', 'N'), (14, 'Y', 'N'), (15, 'N', 'Y'), (16, 'Y', 'N'), (17, 'N', 'N'), (18, 'Y', 'Y'), (19, 'N', 'N'), (20, 'Y', 'N'), (21, 'N', 'Y'), (22, 'Y', 'N'), (23, 'N', 'N'), (24, 'Y', 'Y');\n",
          "expected": "6\n12\n18\n24\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "ordered": false,
      "reference": "SELECT product_id FROM Products WHERE low_fats = 'Y' AND recyclable = 'Y';",
      "editorial": "## Optimal\nBoth flags must be `'Y'`: `WHERE low_fats = 'Y' AND recyclable = 'Y'`. Comparing with the letter, rather than `<> 'N'`, stays right if another value ever appears."
    },
    {
      "slug": "customers-who-never-order",
      "title": "Customers who never ordered",
      "difficulty": "easy",
      "tags": [
        "sql",
        "joins"
      ],
      "stem": "Tables `Customers(id INTEGER, name TEXT)` and `Orders(id INTEGER, customer_id INTEGER)`.\n\nReturn the `name` of every customer with no order, in any order.",
      "tests": [
        {
          "id": "t1",
          "input": "CREATE TABLE Customers (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE Orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES Customers (id));\nINSERT INTO Customers (id, name) VALUES (1, 'Asha'), (2, 'Ravi'), (3, 'Meena'), (4, 'Joseph');\nINSERT INTO Orders (id, customer_id) VALUES (1, 3), (2, 1);\n",
          "expected": "Ravi\nJoseph\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "t2",
          "input": "CREATE TABLE Customers (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE Orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES Customers (id));\nINSERT INTO Customers (id, name) VALUES (1, 'Only');\n",
          "expected": "Only\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t3",
          "input": "CREATE TABLE Customers (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE Orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES Customers (id));\nINSERT INTO Customers (id, name) VALUES (1, 'Customer 1'), (2, 'Customer 2'), (3, 'Customer 3'), (4, 'Customer 4'), (5, 'Customer 5'), (6, 'Customer 6'), (7, 'Customer 7'), (8, 'Customer 8'), (9, 'Customer 9'), (10, 'Customer 10'), (11, 'Customer 11');\nINSERT INTO Orders (id, customer_id) VALUES (1, 4), (2, 7), (3, 10), (4, 2), (5, 5);\n",
          "expected": "Customer 1\nCustomer 3\nCustomer 6\nCustomer 8\nCustomer 9\nCustomer 11\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "ordered": false,
      "reference": "SELECT c.name FROM Customers c LEFT JOIN Orders o ON o.customer_id = c.id WHERE o.id IS NULL;",
      "editorial": "## Brute force: NOT IN\n```sql\nSELECT name FROM Customers WHERE id NOT IN (SELECT customer_id FROM Orders);\n```\nClear, but beware: if any `customer_id` were `NULL`, `NOT IN` would return nothing at all.\n\n## Optimal: LEFT JOIN, keep the unmatched\n```sql\nSELECT c.name FROM Customers c\nLEFT JOIN Orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;\n```\n`NOT EXISTS` is equally good, and safe with `NULL`s."
    },
    {
      "slug": "duplicate-emails",
      "title": "Repeated emails",
      "difficulty": "easy",
      "tags": [
        "sql",
        "group-by"
      ],
      "stem": "Table `Person(id INTEGER, email TEXT)`.\n\nReturn every `email` that appears more than once, each once, in any order.",
      "tests": [
        {
          "id": "t1",
          "input": "CREATE TABLE Person (id INTEGER PRIMARY KEY, email TEXT NOT NULL);\nINSERT INTO Person (id, email) VALUES (1, 'a@b.com'), (2, 'c@d.com'), (3, 'a@b.com');\n",
          "expected": "a@b.com\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "t2",
          "input": "CREATE TABLE Person (id INTEGER PRIMARY KEY, email TEXT NOT NULL);\nINSERT INTO Person (id, email) VALUES (1, 'x@y.com');\n",
          "expected": "",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t3",
          "input": "CREATE TABLE Person (id INTEGER PRIMARY KEY, email TEXT NOT NULL);\nINSERT INTO Person (id, email) VALUES (1, 'user1@mail.in'), (2, 'user2@mail.in'), (3, 'user3@mail.in'), (4, 'user0@mail.in'), (5, 'user1@mail.in'), (6, 'user2@mail.in'), (7, 'user3@mail.in'), (8, 'user0@mail.in'), (9, 'user1@mail.in'), (10, 'user2@mail.in'), (11, 'solo@mail.in');\n",
          "expected": "user0@mail.in\nuser1@mail.in\nuser2@mail.in\nuser3@mail.in\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "ordered": false,
      "reference": "SELECT email FROM Person GROUP BY email HAVING count(*) > 1;",
      "editorial": "## Brute force: self-join\n```sql\nSELECT DISTINCT p1.email FROM Person p1 JOIN Person p2 ON p1.email = p2.email AND p1.id <> p2.id;\n```\nCompares pairs: quadratic in the worst case.\n\n## Optimal: GROUP BY with HAVING\n```sql\nSELECT email FROM Person GROUP BY email HAVING count(*) > 1;\n```\n`HAVING` filters groups after counting, which `WHERE` cannot."
    },
    {
      "slug": "second-highest-salary",
      "title": "Second highest salary",
      "difficulty": "medium",
      "tags": [
        "sql",
        "subquery"
      ],
      "stem": "Table `Employee(id INTEGER, salary INTEGER)`.\n\nReturn one row with one column, `SecondHighestSalary`: the second highest **distinct** salary, or `NULL` when there is none.",
      "tests": [
        {
          "id": "t1",
          "input": "CREATE TABLE Employee (id INTEGER PRIMARY KEY, salary INTEGER NOT NULL);\nINSERT INTO Employee (id, salary) VALUES (1, 100), (2, 200), (3, 300);\n",
          "expected": "200\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "t2",
          "input": "CREATE TABLE Employee (id INTEGER PRIMARY KEY, salary INTEGER NOT NULL);\nINSERT INTO Employee (id, salary) VALUES (1, 100);\n",
          "expected": "NULL\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t3",
          "input": "CREATE TABLE Employee (id INTEGER PRIMARY KEY, salary INTEGER NOT NULL);\nINSERT INTO Employee (id, salary) VALUES (1, 500), (2, 500), (3, 400), (4, 400);\n",
          "expected": "400\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t4",
          "input": "CREATE TABLE Employee (id INTEGER PRIMARY KEY, salary INTEGER NOT NULL);\nINSERT INTO Employee (id, salary) VALUES (1, 700), (2, 700);\n",
          "expected": "NULL\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "ordered": true,
      "reference": "SELECT (SELECT DISTINCT salary FROM Employee ORDER BY salary DESC LIMIT 1 OFFSET 1) AS SecondHighestSalary;",
      "editorial": "## Brute force: the largest below the largest\n```sql\nSELECT max(salary) AS SecondHighestSalary FROM Employee\nWHERE salary < (SELECT max(salary) FROM Employee);\n```\n`max` of no rows is `NULL`, so the empty case comes free.\n\n## Optimal: DISTINCT, OFFSET, wrapped\n```sql\nSELECT (SELECT DISTINCT salary FROM Employee ORDER BY salary DESC LIMIT 1 OFFSET 1) AS SecondHighestSalary;\n```\nThe outer `SELECT` turns \"no row\" into one row holding `NULL`, and the same query finds the *n*th highest by changing the offset."
    },
    {
      "slug": "highest-paid-in-each-department",
      "title": "Highest paid in each department",
      "difficulty": "medium",
      "tags": [
        "sql",
        "joins",
        "window-functions"
      ],
      "stem": "Tables `Employee(id INTEGER, name TEXT, salary INTEGER, department_id INTEGER)` and `Department(id INTEGER, name TEXT)`.\n\nFor each department, return the `Department` name, the `Employee` name and `Salary` of everyone paid the most in it — ties included — in any order.",
      "tests": [
        {
          "id": "t1",
          "input": "CREATE TABLE Department (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE Employee (id INTEGER PRIMARY KEY, name TEXT, salary INTEGER, department_id INTEGER REFERENCES Department (id));\nINSERT INTO Department (id, name) VALUES (1, 'IT'), (2, 'Sales');\nINSERT INTO Employee (id, name, salary, department_id) VALUES (1, 'Joe', 70000, 1), (2, 'Jim', 90000, 1), (3, 'Henry', 80000, 2), (4, 'Sam', 60000, 2), (5, 'Max', 90000, 1);\n",
          "expected": "IT\tJim\t90000\nSales\tHenry\t80000\nIT\tMax\t90000\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "t2",
          "input": "CREATE TABLE Department (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE Employee (id INTEGER PRIMARY KEY, name TEXT, salary INTEGER, department_id INTEGER REFERENCES Department (id));\nINSERT INTO Department (id, name) VALUES (1, 'HR');\nINSERT INTO Employee (id, name, salary, department_id) VALUES (1, 'Solo', 50000, 1);\n",
          "expected": "HR\tSolo\t50000\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t3",
          "input": "CREATE TABLE Department (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE Employee (id INTEGER PRIMARY KEY, name TEXT, salary INTEGER, department_id INTEGER REFERENCES Department (id));\nINSERT INTO Department (id, name) VALUES (1, 'A'), (2, 'B'), (3, 'C');\nINSERT INTO Employee (id, name, salary, department_id) VALUES (1, 'E1', 2000, 2), (2, 'E2', 4000, 3), (3, 'E3', 1000, 1), (4, 'E4', 3000, 2), (5, 'E5', 0, 3), (6, 'E6', 2000, 1), (7, 'E7', 4000, 2), (8, 'E8', 1000, 3), (9, 'E9', 3000, 1), (10, 'E10', 0, 2), (11, 'E11', 2000, 3), (12, 'E12', 4000, 1), (13, 'E13', 1000, 2), (14, 'E14', 3000, 3), (15, 'E15', 0, 1);\n",
          "expected": "C\tE2\t4000\nB\tE7\t4000\nA\tE12\t4000\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "ordered": false,
      "reference": "SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary FROM Employee e JOIN Department d ON d.id = e.department_id WHERE e.salary = (SELECT max(salary) FROM Employee x WHERE x.department_id = e.department_id);",
      "editorial": "## Brute force: a correlated subquery\nFor each employee, compare with their department's maximum:\n```sql\nSELECT d.name AS Department, e.name AS Employee, e.salary AS Salary\nFROM Employee e JOIN Department d ON d.id = e.department_id\nWHERE e.salary = (SELECT max(salary) FROM Employee x WHERE x.department_id = e.department_id);\n```\n\n## Better: join to each department's maximum\n```sql\nSELECT d.name, e.name, e.salary\nFROM Employee e\nJOIN (SELECT department_id, max(salary) AS top FROM Employee GROUP BY department_id) m\n  ON m.department_id = e.department_id AND m.top = e.salary\nJOIN Department d ON d.id = e.department_id;\n```\n\n## Optimal: a window function\n```sql\nSELECT Department, Employee, Salary FROM (\n  SELECT d.name AS Department, e.name AS Employee, e.salary AS Salary,\n         rank() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS r\n  FROM Employee e JOIN Department d ON d.id = e.department_id\n) WHERE r = 1;\n```\n`rank()` gives ties the same rank, so every top earner is kept."
    },
    {
      "slug": "managers-with-five-reports",
      "title": "Managers with five reports",
      "difficulty": "medium",
      "tags": [
        "sql",
        "group-by",
        "self-join"
      ],
      "stem": "Table `Employee(id INTEGER, name TEXT, manager_id INTEGER)`; `manager_id` is another employee's `id`, or `NULL`.\n\nReturn the `name` of every manager with at least five direct reports, in any order.",
      "tests": [
        {
          "id": "t1",
          "input": "CREATE TABLE Employee (id INTEGER PRIMARY KEY, name TEXT, manager_id INTEGER);\nINSERT INTO Employee (id, name, manager_id) VALUES (101, 'John', NULL), (102, 'Dan', 101), (103, 'James', 101), (104, 'Amy', 101), (105, 'Anne', 101), (106, 'Ron', 101);\n",
          "expected": "John\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "t2",
          "input": "CREATE TABLE Employee (id INTEGER PRIMARY KEY, name TEXT, manager_id INTEGER);\nINSERT INTO Employee (id, name, manager_id) VALUES (1, 'Boss', NULL), (2, 'A', 1), (3, 'B', 1), (4, 'C', 1), (5, 'D', 1);\n",
          "expected": "",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t3",
          "input": "CREATE TABLE Employee (id INTEGER PRIMARY KEY, name TEXT, manager_id INTEGER);\nINSERT INTO Employee (id, name, manager_id) VALUES (1, 'Top', NULL), (2, 'R2', 1), (3, 'R3', 1), (4, 'R4', 1), (5, 'R5', 1), (6, 'R6', 1), (7, 'R7', 1), (8, 'R8', 2), (9, 'R9', 2), (10, 'R10', 2), (11, 'R11', 2), (12, 'R12', 2), (13, 'R13', 2);\n",
          "expected": "Top\nR2\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "ordered": false,
      "reference": "SELECT m.name FROM Employee m JOIN Employee e ON e.manager_id = m.id GROUP BY m.id, m.name HAVING count(*) >= 5;",
      "editorial": "## Brute force: count for each employee\n```sql\nSELECT name FROM Employee m\nWHERE (SELECT count(*) FROM Employee e WHERE e.manager_id = m.id) >= 5;\n```\n\n## Optimal: group the reports, then join\n```sql\nSELECT m.name FROM Employee m\nJOIN (SELECT manager_id FROM Employee GROUP BY manager_id HAVING count(*) >= 5) r\n  ON r.manager_id = m.id;\n```\nCounting once per manager, in one pass over the reports."
    },
    {
      "slug": "rank-scores",
      "title": "Rank the scores",
      "difficulty": "medium",
      "tags": [
        "sql",
        "window-functions"
      ],
      "stem": "Table `Scores(id INTEGER, score REAL)`.\n\nReturn every `score` with its `rank`, highest score first. Equal scores share a rank, and the next rank follows on with no gap (1, 1, 2, …).",
      "tests": [
        {
          "id": "t1",
          "input": "CREATE TABLE Scores (id INTEGER PRIMARY KEY, score REAL NOT NULL);\nINSERT INTO Scores (id, score) VALUES (1, 3.5), (2, 3.65), (3, 4.0), (4, 3.85), (5, 4.0), (6, 3.65);\n",
          "expected": "4.0\t1\n4.0\t1\n3.85\t2\n3.65\t3\n3.65\t3\n3.5\t4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "t2",
          "input": "CREATE TABLE Scores (id INTEGER PRIMARY KEY, score REAL NOT NULL);\nINSERT INTO Scores (id, score) VALUES (1, 2.5);\n",
          "expected": "2.5\t1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "t3",
          "input": "CREATE TABLE Scores (id INTEGER PRIMARY KEY, score REAL NOT NULL);\nINSERT INTO Scores (id, score) VALUES (1, 2.0), (2, 4.0), (3, 0.5), (4, 2.5), (5, 4.5), (6, 1.0), (7, 3.0), (8, 5.0), (9, 1.5), (10, 3.5), (11, 0.0), (12, 2.0), (13, 4.0), (14, 0.5), (15, 2.5);\n",
          "expected": "5.0\t1\n4.5\t2\n4.0\t3\n4.0\t3\n3.5\t4\n3.0\t5\n2.5\t6\n2.5\t6\n2.0\t7\n2.0\t7\n1.5\t8\n1.0\t9\n0.5\t10\n0.5\t10\n0.0\t11\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "ordered": true,
      "reference": "SELECT score, dense_rank() OVER (ORDER BY score DESC) AS rank FROM Scores ORDER BY score DESC;",
      "editorial": "## Brute force: count the higher scores\n```sql\nSELECT s.score, (SELECT count(DISTINCT t.score) FROM Scores t WHERE t.score >= s.score) AS rank\nFROM Scores s ORDER BY s.score DESC;\n```\nA score's rank is how many distinct scores are at least it. Quadratic.\n\n## Optimal: dense_rank()\n```sql\nSELECT score, dense_rank() OVER (ORDER BY score DESC) AS rank\nFROM Scores ORDER BY score DESC;\n```\n`rank()` would leave gaps after ties; `dense_rank()` does not."
    }
  ]
}
;
