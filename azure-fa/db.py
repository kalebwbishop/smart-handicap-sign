import pyodbc
import logging
import os
import dotenv

def connect_to_db():
    dotenv.load_dotenv()
    try:
        server = os.getenv("DB_SERVER")
        database = os.getenv("DB_NAME")
        username = os.getenv("DB_USER")
        password = os.getenv("DB_PASS")
        driver = "{ODBC Driver 18 for SQL Server}"

        connection_string = (
            f"DRIVER={driver};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={username};"
            f"PWD={password};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=no;"
            f"Connection Timeout=30;"
        )

        connection = pyodbc.connect(connection_string)
        cursor = connection.cursor()
        
        logging.info("Successfully connected to the database.")
        return connection, cursor

    except Exception as error:
        logging.exception("Error while connecting to db")
        logging.error(f"Error: {error}")
        return None, None

def close_connection(connection, cursor):
    try:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
            logging.info("Database connection closed.")
    except Exception as error:
        logging.exception("Error while closing db connection")

if __name__ == "__main__":
    conn, cur = connect_to_db()
    if conn and cur:
        # Perform database operations here
        close_connection(conn, cur)
