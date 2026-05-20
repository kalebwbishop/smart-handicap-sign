// Extension: hazard-hero-postgres
// Expose backend Postgres read/write tools using backend/.env

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { joinSession } from "@github/copilot-sdk/extension";

const extensionFile = fileURLToPath(import.meta.url);
const extensionDir = path.dirname(extensionFile);
const repoRoot = path.resolve(extensionDir, "..", "..", "..");
const backendDir = path.join(repoRoot, "backend");
const envPath = path.join(backendDir, ".env");
const helperPath = path.join(extensionDir, "postgres_tool.py");

function toolResult(textResultForLlm, resultType = "success") {
    return { textResultForLlm, resultType };
}

function validateSetup() {
    if (!existsSync(backendDir)) {
        return `Error: backend directory not found at ${backendDir}.`;
    }

    if (!existsSync(envPath)) {
        return `Error: backend .env file not found at ${envPath}. Create backend\\.env with POSTGRES_CONNECTION_STRING before using this extension.`;
    }

    if (!existsSync(helperPath)) {
        return `Error: Postgres helper script not found at ${helperPath}.`;
    }

    return null;
}

function pythonCandidates() {
    if (process.platform === "win32") {
        return [["python"], ["py", "-3"]];
    }

    return [["python3"], ["python"]];
}

function runPython(command, args, payload) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: backendDir,
            env: {
                ...process.env,
                PYTHONIOENCODING: "utf-8",
            },
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", reject);
        child.on("close", (code) => {
            resolve({
                code,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
            });
        });

        child.stdin.end(JSON.stringify(payload));
    });
}

async function runHelper(mode, args) {
    const setupError = validateSetup();
    if (setupError) {
        return toolResult(setupError, "failure");
    }

    let lastError = "Error: unable to run the backend Postgres helper.";

    for (const candidate of pythonCandidates()) {
        const [command, ...baseArgs] = candidate;

        try {
            const result = await runPython(command, [...baseArgs, helperPath, mode], args);

            if (result.code === 0) {
                return toolResult(result.stdout || "Command completed successfully.");
            }

            lastError = result.stderr || result.stdout || `Error: ${command} exited with code ${result.code}.`;
        } catch (error) {
            lastError = `Error: failed to start ${command}: ${error.message}`;
        }
    }

    return toolResult(lastError, "failure");
}

await joinSession({
    tools: [
        {
            name: "hazard_hero_postgres_list_tables",
            description: "List tables and views from the Postgres database configured by backend/.env. Use this first when you need schema discovery.",
            parameters: {
                type: "object",
                properties: {
                    schema: {
                        type: "string",
                        description: "Schema name to inspect. Defaults to public.",
                        default: "public",
                    },
                },
            },
            handler: async (args) =>
                runHelper("list_tables", {
                    schema: args?.schema ?? "public",
                }),
        },
        {
            name: "hazard_hero_postgres_describe_table",
            description: "Describe a table or view from the Postgres database configured by backend/.env, including columns, defaults, nullability, and primary-key flags.",
            parameters: {
                type: "object",
                properties: {
                    table_name: {
                        type: "string",
                        description: "Table or view name, for example users or organizations.",
                    },
                    schema: {
                        type: "string",
                        description: "Schema name to inspect. Defaults to public.",
                        default: "public",
                    },
                },
                required: ["table_name"],
            },
            handler: async (args) =>
                runHelper("describe_table", {
                    table_name: args.table_name,
                    schema: args?.schema ?? "public",
                }),
        },
        {
            name: "hazard_hero_postgres_query_sql",
            description: "Run a read-only SQL query against the Postgres database configured by backend/.env. Accepts SELECT, WITH, SHOW, and EXPLAIN statements with optional asyncpg-style positional parameters ($1, $2, ...), and executes them in a read-only transaction.",
            parameters: {
                type: "object",
                properties: {
                    sql: {
                        type: "string",
                        description: "Read-only SQL statement. Prefer adding LIMIT to large queries.",
                    },
                    params: {
                        type: "array",
                        description: "Optional positional parameters bound to $1, $2, and so on.",
                        items: {},
                        default: [],
                    },
                    max_rows: {
                        type: "integer",
                        description: "Maximum rows returned to the agent before truncation metadata is set.",
                        minimum: 1,
                        maximum: 200,
                        default: 50,
                    },
                },
                required: ["sql"],
            },
            handler: async (args) =>
                runHelper("query_sql", {
                    sql: args.sql,
                    params: args?.params ?? [],
                    max_rows: args?.max_rows ?? 50,
                }),
        },
        {
            name: "hazard_hero_postgres_execute_sql",
            description: "Run a write-capable SQL statement against the Postgres database configured by backend/.env. Use this for INSERT, UPDATE, DELETE, write CTEs, and schema changes. Plain SELECT, SHOW, and EXPLAIN statements are rejected so they stay on the query tool.",
            parameters: {
                type: "object",
                properties: {
                    sql: {
                        type: "string",
                        description: "Write-capable SQL statement. Plain SELECT, SHOW, and EXPLAIN are rejected so they stay on the query tool.",
                    },
                    params: {
                        type: "array",
                        description: "Optional positional parameters bound to $1, $2, and so on.",
                        items: {},
                        default: [],
                    },
                },
                required: ["sql"],
            },
            handler: async (args) =>
                runHelper("execute_sql", {
                    sql: args.sql,
                    params: args?.params ?? [],
                }),
        },
    ],
});
