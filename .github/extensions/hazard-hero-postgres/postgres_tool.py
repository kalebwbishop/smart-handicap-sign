import asyncio
import json
import re
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
BACKEND_DIR = REPO_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

QUERY_SQL_RE = re.compile(r"^\s*(select|with|show|explain)\b", re.IGNORECASE)
PLAIN_READ_ONLY_SQL_RE = re.compile(r"^\s*(select|show|explain)\b", re.IGNORECASE)
RETURNING_RE = re.compile(r"\breturning\b", re.IGNORECASE)


def dump_json(payload: object) -> str:
    return json.dumps(payload, indent=2, default=str)


def load_payload() -> dict:
    raw_payload = sys.stdin.read().strip()
    if not raw_payload:
        return {}

    try:
        payload = json.loads(raw_payload)
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON input: {error}") from error

    if not isinstance(payload, dict):
        raise ValueError("Tool input must be a JSON object.")

    return payload


def ensure_str(value: object, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty string.")
    return value


def ensure_params(value: object) -> list:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("params must be an array.")
    return value


def ensure_max_rows(value: object) -> int:
    if value is None:
        return 50
    if not isinstance(value, int):
        raise ValueError("max_rows must be an integer.")
    if value < 1 or value > 200:
        raise ValueError("max_rows must be between 1 and 200.")
    return value


def is_query_sql(sql: str) -> bool:
    return bool(QUERY_SQL_RE.match(sql))


def is_plain_read_only_sql(sql: str) -> bool:
    return bool(PLAIN_READ_ONLY_SQL_RE.match(sql))


def row_to_dict(record) -> dict:
    return {key: record[key] for key in record.keys()}


async def connect():
    try:
        import asyncpg
        from app.config.settings import get_settings
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "Backend Python dependencies are not available. Run `cd backend && pip install -r requirements.txt` before using this extension."
        ) from error

    settings = get_settings()
    return await asyncpg.connect(dsn=settings.postgres_connection_string, command_timeout=30)


async def list_tables(payload: dict) -> dict:
    schema = payload.get("schema") or "public"
    schema = ensure_str(schema, "schema")

    conn = await connect()
    try:
        rows = await conn.fetch(
            """
            SELECT table_schema, table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = $1
            ORDER BY table_type, table_name
            """,
            schema,
        )
    finally:
        await conn.close()

    return {
        "schema": schema,
        "count": len(rows),
        "tables": [row_to_dict(row) for row in rows],
    }


async def describe_table(payload: dict) -> dict:
    schema = payload.get("schema") or "public"
    schema = ensure_str(schema, "schema")
    table_name = ensure_str(payload.get("table_name"), "table_name")

    conn = await connect()
    try:
        columns = await conn.fetch(
            """
            SELECT
                c.ordinal_position,
                c.column_name,
                c.data_type,
                c.udt_name,
                c.is_nullable,
                c.column_default,
                EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                        AND tc.table_schema = c.table_schema
                        AND tc.table_name = c.table_name
                        AND kcu.column_name = c.column_name
                ) AS is_primary_key
            FROM information_schema.columns c
            WHERE c.table_schema = $1
              AND c.table_name = $2
            ORDER BY c.ordinal_position
            """,
            schema,
            table_name,
        )
    finally:
        await conn.close()

    if not columns:
        raise ValueError(f"Table or view {schema}.{table_name} was not found.")

    return {
        "schema": schema,
        "table_name": table_name,
        "column_count": len(columns),
        "columns": [row_to_dict(row) for row in columns],
    }


async def query_sql(payload: dict) -> dict:
    sql = ensure_str(payload.get("sql"), "sql")
    params = ensure_params(payload.get("params"))
    max_rows = ensure_max_rows(payload.get("max_rows"))

    if not is_query_sql(sql):
        raise ValueError(
            "query_sql only accepts read-only statements that start with SELECT, WITH, SHOW, or EXPLAIN."
        )

    conn = await connect()
    rows = []
    truncated = False

    try:
        async with conn.transaction(readonly=True):
            cursor = conn.cursor(sql, *params, prefetch=min(max_rows, 50))
            async for record in cursor:
                if len(rows) >= max_rows:
                    truncated = True
                    break
                rows.append(row_to_dict(record))
    finally:
        await conn.close()

    return {
        "row_count": len(rows),
        "max_rows": max_rows,
        "truncated": truncated,
        "rows": rows,
    }


async def execute_sql(payload: dict) -> dict:
    sql = ensure_str(payload.get("sql"), "sql")
    params = ensure_params(payload.get("params"))

    if is_plain_read_only_sql(sql):
        raise ValueError("execute_sql rejects plain SELECT, SHOW, and EXPLAIN statements. Use query_sql instead.")

    conn = await connect()
    try:
        if RETURNING_RE.search(sql):
            rows = await conn.fetch(sql, *params)
            return {
                "row_count": len(rows),
                "rows": [row_to_dict(row) for row in rows],
            }

        command_tag = await conn.execute(sql, *params)
        return {"command_tag": command_tag}
    finally:
        await conn.close()


async def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python postgres_tool.py <list_tables|describe_table|query_sql|execute_sql>", file=sys.stderr)
        return 1

    mode = sys.argv[1]

    try:
        payload = load_payload()

        if mode == "list_tables":
            result = await list_tables(payload)
        elif mode == "describe_table":
            result = await describe_table(payload)
        elif mode == "query_sql":
            result = await query_sql(payload)
        elif mode == "execute_sql":
            result = await execute_sql(payload)
        else:
            print(f"Unknown mode: {mode}", file=sys.stderr)
            return 1

        print(dump_json(result))
        return 0
    except (RuntimeError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except Exception as error:  # pragma: no cover - safety net for CLI execution
        print(f"Error: unexpected database helper failure: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
