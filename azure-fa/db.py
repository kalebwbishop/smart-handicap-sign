import pyodbc

def connect_to_db():
    try:
        # Connection settings
        server = "hazard-hero-dbs.database.windows.net"
        database = "hazard-hero-db"
        username = "bishopkw"
        password = "School30332319!!"  # Replace with your password
        driver = "{ODBC Driver 18 for SQL Server}"

        # Create the connection string
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

        # Establish connection
        connection = pyodbc.connect(connection_string)
        print("Connection successful!")

        # Create a cursor object
        cursor = connection.cursor()

        return connection, cursor

    except Exception as error:
        print("Error while connecting to PostgreSQL:", error)
        return None, None

def close_connection(connection, cursor):
    if connection:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    conn, cur = connect_to_db()
    if conn:
        # Perform database operations here
        close_connection(conn, cur)
