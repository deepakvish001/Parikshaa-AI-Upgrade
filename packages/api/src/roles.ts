/**
 * The role library (docs/PREP-TRACKER.md, V2-12 CO7): the tests Indian
 * recruiters send most often, each as sections of the question bank to draw
 * from. A section is matched to bank questions by its keywords, against each
 * question's topic and tags, so a bank filed "Quantitative aptitude" or tagged
 * "percentages" both feed the aptitude section. Counts and times follow what
 * the usual online assessments for the role ask.
 *
 * Sixty roles, tech only (docs/LAUNCH-PLAN.md §1, F1 Hire), grouped in
 * families so a recruiter finds theirs by searching or scanning a group.
 */

export type Seniority = "fresher" | "junior" | "mid" | "senior";
export type Kind = "mcq" | "numeric" | "short" | "code";

export interface RoleSection {
  readonly id: string;
  readonly title: string;
  /** Lower-case words matched inside a question's topic or tags. */
  readonly keywords: readonly string[];
  readonly kinds: readonly Kind[];
  /** Questions each candidate gets. */
  readonly count: number;
}

export const FAMILIES = ["Campus and mass hiring", "Software engineering", "Web and mobile", "Data and AI", "Cloud and infrastructure", "Quality and security", "Enterprise platforms"] as const;
export type Family = (typeof FAMILIES)[number];

export interface Role {
  readonly id: string;
  readonly family: Family;
  readonly title: string;
  readonly summary: string;
  readonly sections: readonly RoleSection[];
  /** Qualifying mark, percent of the paper. */
  readonly cutoffPercent: number;
}

const OBJECTIVE: readonly Kind[] = ["mcq", "numeric"];

const APTITUDE = (count: number): RoleSection => ({
  id: "aptitude",
  title: "Quantitative aptitude",
  keywords: ["aptitude", "quant", "arithmetic", "percentage", "profit", "ratio", "time and work", "speed", "interest", "probability", "number system", "averages", "permutation"],
  kinds: OBJECTIVE,
  count,
});
const REASONING = (count: number): RoleSection => ({
  id: "reasoning",
  title: "Logical reasoning",
  keywords: ["reasoning", "logical", "puzzle", "series", "seating", "blood relation", "coding-decoding", "syllogism", "direction", "data interpretation"],
  kinds: OBJECTIVE,
  count,
});
const VERBAL = (count: number): RoleSection => ({
  id: "verbal",
  title: "Verbal ability",
  keywords: ["verbal", "english", "grammar", "reading comprehension", "comprehension", "vocabulary", "sentence", "synonym", "antonym"],
  kinds: OBJECTIVE,
  count,
});
const CODING = (count: number): RoleSection => ({
  id: "coding",
  title: "Coding",
  keywords: ["dsa", "array", "string", "linked list", "tree", "graph", "dynamic programming", "sorting", "searching", "hashing", "recursion", "stack", "queue", "greedy", "coding", "programming"],
  kinds: ["code"],
  count,
});
const SQL = (count: number): RoleSection => ({
  id: "sql",
  title: "SQL and databases",
  keywords: ["sql", "dbms", "database", "join", "normalization", "normalisation", "query", "index", "transaction"],
  kinds: OBJECTIVE,
  count,
});
const CS_CORE = (count: number): RoleSection => ({
  id: "cs",
  title: "CS fundamentals",
  keywords: ["operating system", "os", "computer network", "networks", "cn", "oop", "object oriented", "dbms", "computer science"],
  kinds: OBJECTIVE,
  count,
});

/** A section of objective questions on one subject. */
const topic = (id: string, title: string, keywords: readonly string[]) => (count: number): RoleSection => ({ id, title, keywords, kinds: OBJECTIVE, count });

const JAVA = topic("java", "Java and OOP", ["java", "oop", "object oriented", "collections", "exception", "jvm", "multithreading"]);
const SPRING = topic("spring", "Spring Boot and microservices", ["spring", "spring boot", "hibernate", "jpa", "microservice", "microservices", "rest"]);
const PYTHON = topic("python", "Python", ["python", "list comprehension", "decorator", "generator", "pandas", "numpy"]);
const DJANGO = topic("django", "Django and Flask", ["django", "flask", "fastapi", "orm", "rest"]);
const CPP = topic("cpp", "C++", ["c++", "cpp", "stl", "pointer", "templates", "oop"]);
const C_LANG = topic("c", "C programming", ["c programming", "c language", "pointer", "memory", "struct", "bitwise"]);
const CSHARP = topic("dotnet", "C# and .NET", ["c#", "csharp", ".net", "dotnet", "asp.net", "linq", "entity framework"]);
const GO = topic("go", "Go", ["go", "golang", "goroutine", "channel", "concurrency"]);
const RUST = topic("rust", "Rust", ["rust", "ownership", "borrow", "lifetime", "cargo"]);
const NODE = topic("node", "Node.js and Express", ["node", "node.js", "nodejs", "express", "npm", "event loop", "rest"]);
const WEB = topic("web", "HTML, CSS and JavaScript", ["javascript", "js", "html", "css", "dom", "web", "typescript", "frontend", "browser"]);
const REACT = topic("react", "React", ["react", "hooks", "redux", "jsx", "next.js", "nextjs"]);
const ANGULAR = topic("angular", "Angular", ["angular", "rxjs", "typescript", "component", "dependency injection"]);
const MONGO = topic("mongo", "MongoDB", ["mongodb", "mongo", "nosql", "aggregation", "mongoose"]);
const PHP = topic("php", "PHP and Laravel", ["php", "laravel", "composer", "mvc"]);
const ANDROID = topic("android", "Android and Kotlin", ["android", "kotlin", "activity", "jetpack", "compose", "gradle"]);
const IOS = topic("ios", "iOS and Swift", ["ios", "swift", "swiftui", "uikit", "xcode"]);
const FLUTTER = topic("flutter", "Flutter and Dart", ["flutter", "dart", "widget", "react native", "mobile"]);
const UI = topic("ui", "Accessible, responsive UI", ["css", "html", "accessibility", "a11y", "responsive", "design system", "figma"]);
const DESIGN = topic("design", "System design", ["system design", "scalability", "caching", "load balancer", "microservices", "distributed", "design pattern", "lld", "hld"]);
const STATS = topic("stats", "Statistics and data", ["statistics", "probability", "excel", "data interpretation", "mean", "regression", "data", "analytics"]);
const BIGDATA = topic("bigdata", "Data pipelines", ["spark", "hadoop", "etl", "airflow", "kafka", "data warehouse", "big data", "pyspark", "data engineering"]);
const ML = topic("ml", "Machine learning", ["machine learning", "ml", "regression", "classification", "clustering", "scikit-learn", "overfitting", "feature engineering"]);
const DL = topic("dl", "Deep learning", ["deep learning", "neural network", "cnn", "rnn", "pytorch", "tensorflow", "transformer"]);
const NLP = topic("nlp", "NLP", ["nlp", "natural language", "tokenization", "embedding", "transformer", "text classification"]);
const VISION = topic("vision", "Computer vision", ["computer vision", "opencv", "cnn", "image", "object detection", "segmentation"]);
const GENAI = topic("genai", "LLMs and generative AI", ["llm", "generative ai", "genai", "prompt", "rag", "embedding", "vector", "fine-tuning", "agent"]);
const MLOPS = topic("mlops", "MLOps", ["mlops", "model deployment", "mlflow", "model monitoring", "feature store", "docker", "kubernetes"]);
const BI = topic("bi", "BI and dashboards", ["power bi", "tableau", "dax", "dashboard", "excel", "looker", "visualization"]);
const PLSQL = topic("plsql", "PL/SQL and stored procedures", ["pl/sql", "plsql", "stored procedure", "trigger", "cursor", "t-sql"]);
const DBA = topic("dba", "Database administration", ["dba", "backup", "replication", "index", "performance tuning", "postgresql", "mysql", "oracle"]);
const LINUX = topic("linux", "Linux and scripting", ["linux", "shell", "bash", "unix", "scripting"]);
const NETWORK = topic("network", "Networking", ["network", "tcp", "dns", "http", "computer network", "cn", "routing", "subnet", "osi"]);
const CLOUD = topic("cloud", "Containers, CI/CD and cloud", ["docker", "kubernetes", "ci/cd", "aws", "azure", "gcp", "cloud", "git", "devops", "terraform"]);
const AWS = topic("aws", "AWS", ["aws", "ec2", "s3", "iam", "vpc", "lambda", "rds", "cloudformation"]);
const AZURE = topic("azure", "Azure", ["azure", "active directory", "entra", "arm template", "azure devops", "app service"]);
const K8S = topic("k8s", "Kubernetes", ["kubernetes", "k8s", "helm", "pod", "container", "docker"]);
const SRE = topic("sre", "Reliability and observability", ["sre", "monitoring", "observability", "prometheus", "grafana", "incident", "slo", "logging"]);
const TESTING = topic("testing", "Software testing", ["testing", "qa", "test case", "sdlc", "stlc", "bug", "regression testing"]);
const AUTOMATION = topic("automation", "Test automation", ["selenium", "automation", "cypress", "playwright", "testng", "junit", "pytest", "api testing"]);
const PERF = topic("perf", "Performance testing", ["performance testing", "jmeter", "load testing", "loadrunner", "gatling", "latency"]);
const SECURITY = topic("security", "Security", ["security", "owasp", "xss", "sql injection", "encryption", "authentication", "vulnerability", "firewall"]);
const APPSEC = topic("appsec", "Application security", ["owasp", "xss", "csrf", "sql injection", "threat modeling", "penetration testing", "burp", "secure coding"]);
const EMBEDDED = topic("embedded", "Embedded systems", ["embedded", "microcontroller", "rtos", "arm", "interrupt", "i2c", "spi", "uart"]);
const SALESFORCE = topic("salesforce", "Salesforce", ["salesforce", "apex", "visualforce", "lightning", "soql", "crm"]);
const SAP = topic("sap", "SAP ABAP", ["sap", "abap", "hana", "odata", "fiori"]);
const SERVICENOW = topic("servicenow", "ServiceNow", ["servicenow", "itsm", "glide", "workflow", "itil"]);
const MAINFRAME = topic("mainframe", "Mainframe", ["mainframe", "cobol", "jcl", "db2", "cics"]);
const SUPPORT = topic("support", "Troubleshooting", ["troubleshooting", "operating system", "windows", "networking", "ticket", "itil", "hardware"]);

const role = (family: Family, id: string, title: string, summary: string, sections: readonly RoleSection[], cutoffPercent = 60): Role => ({ id, family, title, summary, sections, cutoffPercent });

const CAMPUS: Family = "Campus and mass hiring";
const SWE: Family = "Software engineering";
const WEBM: Family = "Web and mobile";
const DATA: Family = "Data and AI";
const INFRA: Family = "Cloud and infrastructure";
const QUALITY: Family = "Quality and security";
const ENTERPRISE: Family = "Enterprise platforms";

export const ROLES: readonly Role[] = [
  role(CAMPUS, "fresher-aptitude", "Fresher aptitude (mass hiring)", "The first round of a service-company drive: aptitude, reasoning and English.", [APTITUDE(20), REASONING(15), VERBAL(15)]),
  role(CAMPUS, "campus-software", "Campus software engineer", "The usual product-company campus test: aptitude, CS fundamentals and coding.", [APTITUDE(10), CS_CORE(10), CODING(2)]),
  role(CAMPUS, "campus-service", "Service-company campus drive", "Aptitude, reasoning and English, with one easy coding problem.", [APTITUDE(15), REASONING(10), VERBAL(10), CODING(1)]),
  role(CAMPUS, "campus-product", "Product-company campus drive", "A short aptitude round, CS fundamentals and three coding problems.", [APTITUDE(6), CS_CORE(8), CODING(3)]),
  role(CAMPUS, "graduate-trainee", "Graduate engineer trainee", "Aptitude, reasoning and CS fundamentals, with one coding problem.", [APTITUDE(12), REASONING(8), CS_CORE(10), CODING(1)]),
  role(CAMPUS, "sde-intern", "Software engineering intern", "CS fundamentals and two coding problems.", [CS_CORE(8), CODING(2)]),

  role(SWE, "java-developer", "Java developer", "Java and object-oriented design, databases, and two coding problems.", [JAVA(12), SQL(6), APTITUDE(8), CODING(2)]),
  role(SWE, "spring-boot-developer", "Spring Boot developer", "Java, Spring Boot and microservices, SQL, and one coding problem.", [JAVA(8), SPRING(10), SQL(6), CODING(1)]),
  role(SWE, "python-developer", "Python developer", "Python, databases, and two coding problems.", [PYTHON(12), SQL(6), APTITUDE(8), CODING(2)]),
  role(SWE, "django-developer", "Django / FastAPI developer", "Python, a web framework, SQL, and one coding problem.", [PYTHON(8), DJANGO(10), SQL(6), CODING(1)]),
  role(SWE, "cpp-developer", "C++ developer", "C++ and CS fundamentals, with two coding problems.", [CPP(12), CS_CORE(8), CODING(2)]),
  role(SWE, "dotnet-developer", ".NET developer", "C# and .NET, SQL, and one coding problem.", [CSHARP(12), SQL(6), CS_CORE(4), CODING(1)]),
  role(SWE, "go-developer", "Go developer", "Go and concurrency, networking basics, and two coding problems.", [GO(12), NETWORK(5), CODING(2)]),
  role(SWE, "rust-developer", "Rust / systems programmer", "Rust, operating systems, and two coding problems.", [RUST(10), CS_CORE(8), CODING(2)]),
  role(SWE, "node-developer", "Node.js backend developer", "Node.js, JavaScript, databases, and two coding problems.", [NODE(12), WEB(5), SQL(6), CODING(2)]),
  role(SWE, "backend-engineer", "Backend engineer", "CS fundamentals, databases, system design basics, and two coding problems.", [CS_CORE(8), SQL(6), DESIGN(5), CODING(2)]),
  role(SWE, "sde-1", "Software engineer (SDE 1)", "CS fundamentals and three coding problems.", [CS_CORE(8), CODING(3)]),
  role(SWE, "sde-2", "Software engineer (SDE 2)", "System design, CS fundamentals, and three coding problems.", [DESIGN(8), CS_CORE(6), CODING(3)]),
  role(SWE, "senior-backend", "Senior backend engineer", "System design in depth and two hard coding problems.", [DESIGN(12), SQL(4), CODING(2)], 55),
  role(SWE, "embedded-developer", "Embedded C developer", "C, embedded systems and operating systems, with one coding problem.", [C_LANG(10), EMBEDDED(10), CS_CORE(5), CODING(1)]),

  role(WEBM, "frontend-developer", "Frontend developer", "HTML, CSS, JavaScript and React, with one coding problem.", [WEB(15), APTITUDE(8), CODING(1)]),
  role(WEBM, "react-developer", "React developer", "JavaScript and React, with one coding problem.", [WEB(8), REACT(12), CODING(1)]),
  role(WEBM, "angular-developer", "Angular developer", "JavaScript, TypeScript and Angular, with one coding problem.", [WEB(8), ANGULAR(12), CODING(1)]),
  role(WEBM, "ui-engineer", "UI engineer", "HTML, CSS, accessibility and responsive layout.", [UI(12), WEB(8), CODING(1)]),
  role(WEBM, "mern-developer", "Full-stack developer (MERN)", "React, Node.js, MongoDB, and two coding problems.", [REACT(8), NODE(8), MONGO(5), CODING(2)]),
  role(WEBM, "java-fullstack", "Full-stack developer (Java + React)", "Spring Boot, React, SQL, and two coding problems.", [SPRING(8), REACT(8), SQL(5), CODING(2)]),
  role(WEBM, "php-developer", "PHP / Laravel developer", "PHP and Laravel, SQL, and one coding problem.", [PHP(12), SQL(6), WEB(4), CODING(1)]),
  role(WEBM, "android-developer", "Android developer", "Kotlin and Android, with two coding problems.", [ANDROID(14), CS_CORE(4), CODING(2)]),
  role(WEBM, "ios-developer", "iOS developer", "Swift and iOS, with two coding problems.", [IOS(14), CS_CORE(4), CODING(2)]),
  role(WEBM, "flutter-developer", "Flutter / cross-platform developer", "Flutter and Dart, with one coding problem.", [FLUTTER(14), CS_CORE(4), CODING(1)]),

  role(DATA, "data-analyst", "Data analyst", "SQL, statistics and data interpretation.", [SQL(12), STATS(10), APTITUDE(8)]),
  role(DATA, "business-analyst", "Business analyst (tech)", "SQL, spreadsheets and dashboards, reasoning.", [SQL(8), BI(8), REASONING(8)]),
  role(DATA, "bi-developer", "BI / Power BI developer", "Dashboards and data models, SQL.", [BI(14), SQL(10)]),
  role(DATA, "sql-developer", "SQL / PL-SQL developer", "SQL in depth and stored procedures.", [SQL(14), PLSQL(10)]),
  role(DATA, "data-engineer", "Data engineer", "SQL, Python and data pipelines, with one coding problem.", [SQL(8), PYTHON(6), BIGDATA(10), CODING(1)]),
  role(DATA, "data-scientist", "Data scientist", "Statistics, machine learning, Python and SQL, with one coding problem.", [STATS(8), ML(10), PYTHON(6), SQL(4), CODING(1)]),
  role(DATA, "ml-engineer", "Machine learning engineer", "Machine learning, deep learning, Python, and two coding problems.", [ML(10), DL(6), PYTHON(6), CODING(2)]),
  role(DATA, "genai-engineer", "AI / GenAI engineer", "LLMs, retrieval and prompting, Python, and one coding problem.", [GENAI(12), ML(5), PYTHON(6), CODING(1)]),
  role(DATA, "nlp-engineer", "NLP engineer", "Language models and text processing, with one coding problem.", [NLP(12), DL(6), PYTHON(5), CODING(1)]),
  role(DATA, "vision-engineer", "Computer vision engineer", "Image models and OpenCV, with one coding problem.", [VISION(12), DL(6), PYTHON(5), CODING(1)]),
  role(DATA, "mlops-engineer", "MLOps engineer", "Putting models into production: pipelines, containers, monitoring.", [MLOPS(12), CLOUD(6), PYTHON(5), CODING(1)]),
  role(DATA, "dba", "Database administrator", "Administration, tuning and recovery of databases.", [DBA(14), SQL(8), LINUX(4)]),

  role(INFRA, "devops-engineer", "DevOps / cloud engineer", "Linux, networking, containers and cloud.", [LINUX(8), NETWORK(6), CLOUD(10), APTITUDE(6)]),
  role(INFRA, "aws-engineer", "AWS cloud engineer", "AWS services, networking and Linux.", [AWS(14), NETWORK(6), LINUX(6)]),
  role(INFRA, "azure-engineer", "Azure cloud engineer", "Azure services, networking and scripting.", [AZURE(14), NETWORK(6), LINUX(6)]),
  role(INFRA, "kubernetes-engineer", "Platform / Kubernetes engineer", "Kubernetes, containers and CI/CD.", [K8S(14), CLOUD(8), LINUX(4)]),
  role(INFRA, "sre", "Site reliability engineer", "Reliability, observability, Linux, and one coding problem.", [SRE(10), LINUX(8), NETWORK(6), CODING(1)]),
  role(INFRA, "linux-admin", "Linux system administrator", "Linux, shell scripting and networking.", [LINUX(16), NETWORK(8)]),
  role(INFRA, "network-engineer", "Network engineer", "Routing, switching and network security.", [NETWORK(16), SECURITY(6), APTITUDE(4)]),

  role(QUALITY, "qa-engineer", "QA / test engineer", "Testing concepts and automation, programming basics, SQL.", [TESTING(15), SQL(5), APTITUDE(8), CODING(1)]),
  role(QUALITY, "automation-tester", "Automation test engineer", "Testing, Selenium-style automation, and one coding problem.", [TESTING(8), AUTOMATION(12), CODING(1)]),
  role(QUALITY, "sdet", "SDET", "Test automation and two coding problems.", [AUTOMATION(10), TESTING(6), CODING(2)]),
  role(QUALITY, "performance-tester", "Performance test engineer", "Load and performance testing, and networking.", [PERF(14), TESTING(6), NETWORK(4)]),
  role(QUALITY, "security-analyst", "Security analyst", "Security concepts, networking and Linux.", [SECURITY(14), NETWORK(8), LINUX(4)]),
  role(QUALITY, "appsec-engineer", "Application security engineer", "Web application security and secure coding, with one coding problem.", [APPSEC(14), WEB(5), CODING(1)]),

  role(ENTERPRISE, "salesforce-developer", "Salesforce developer", "Apex, Lightning and SOQL.", [SALESFORCE(16), SQL(4), CODING(1)]),
  role(ENTERPRISE, "sap-abap-developer", "SAP ABAP developer", "ABAP and SAP data.", [SAP(16), SQL(6)]),
  role(ENTERPRISE, "servicenow-developer", "ServiceNow developer", "ServiceNow scripting and ITSM.", [SERVICENOW(16), WEB(6)]),
  role(ENTERPRISE, "mainframe-developer", "Mainframe developer", "COBOL, JCL and DB2.", [MAINFRAME(16), SQL(6)]),
  role(ENTERPRISE, "tech-support", "Technical support engineer", "Troubleshooting, operating systems and networking.", [SUPPORT(12), NETWORK(8), VERBAL(6)], 55),
];

/** Minutes a candidate needs for one question of each kind, as the usual assessments allow. */
export const MINUTES: Readonly<Record<Kind, number>> = { mcq: 1.2, numeric: 1.5, short: 6, code: 25 };

/** Which difficulties to prefer, most wanted first, for how senior the role is. */
export const DIFFICULTY_ORDER: Readonly<Record<Seniority, readonly ("easy" | "medium" | "hard")[]>> = {
  fresher: ["medium", "easy", "hard"],
  junior: ["medium", "hard", "easy"],
  mid: ["hard", "medium", "easy"],
  senior: ["hard", "medium", "easy"],
};

export const roleById = (id: string): Role | undefined => ROLES.find((r) => r.id === id);
