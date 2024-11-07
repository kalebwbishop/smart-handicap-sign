from dotenv import load_dotenv
import psycopg2
import os

load_dotenv()

class DatabaseService:
    __HOST = os.getenv("DB_HOST")
    __DATABASE = os.getenv("DB_NAME")
    __USERNAME = os.getenv("DB_USER")
    __PASSWORD = os.getenv("DB_PASS")
    __PORT = os.getenv("DB_PORT") or '5432'

    def __init__(self):
        self.conn = None
        self.connect()

    def connect(self):
        if self.conn is None:
            try:
                print("Establishing database connection...")
                self.conn = psycopg2.connect(
                    host=DatabaseService.__HOST,
                    database=DatabaseService.__DATABASE,
                    user=DatabaseService.__USERNAME,
                    password=DatabaseService.__PASSWORD,
                    port=DatabaseService.__PORT,
                )
            except psycopg2.DatabaseError as e:
                print(f"Error connecting to the database: {e}")
                raise
            finally:
                print("Database connection established.")

    def execute_fetchone_query(self, query):
        self.connect()  # Ensure connection is established
        try:
            with self.conn.cursor() as cursor:
                cursor.execute(query)
                row = cursor.fetchone()
                return row
        except psycopg2.DatabaseError as e:
            print(f"Error executing fetchone query: {e}")
            raise

    def execute_fetchall_query(self, query):
        self.connect()  # Ensure connection is established
        try:
            with self.conn.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()
                return rows
        except psycopg2.DatabaseError as e:
            print(f"Error executing fetchall query: {e}")
            raise

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None
            print("Database connection closed.")

if __name__ == '__main__':
    db = DatabaseService()
    try:
        users = db.execute_fetchall_query("SELECT * FROM users")
        print(users)
    finally:
        db.close()  # Ensure the connection is closed when done