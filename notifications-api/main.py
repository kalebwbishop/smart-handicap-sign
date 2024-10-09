import psycopg2
from psycopg2 import sql

class NotificationDB:
    def __init__(self):
        self.connection = self.__connect_to_db()

    def __connect_to_db(self):
        # Define the connection parameters
        db_params = {
            'dbname': 'postgres',
            'user': 'postgres',
            'password': '6qZI5LnBjlLkVdSL',
            'host': 'quickly-exuberant-garpike.data-1.use1.tembo.io',
            'port': '5432'
        }

        # Create a connection to the database
        try:
            # Connect to PostgreSQL
            connection = psycopg2.connect(**db_params)
            
            # Create a cursor object
            cursor = connection.cursor()
            
            # Print PostgreSQL details
            print("PostgreSQL connection established successfully")
            
            # Example query (optional)
            cursor.execute("SELECT version();")
            db_version = cursor.fetchone()
            print(f"PostgreSQL database version: {db_version}")
            return connection
        
        except Exception as error:
            print(f"Error connecting to PostgreSQL: {error}")


    def get_users_of_input_device(self, device_id):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            SELECT u.* 
            FROM users u
            JOIN users_input_devices uindev ON u.id = uindev.user_id
            JOIN input_devices indev ON uindev.input_device_id = indev.id
            WHERE indev.id = %s
            """, 
            (device_id,)
        )

        result = cursor.fetchall()

        cursor.close()

        return result


    def get_output_devices_of_user(self, user_id):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            SELECT outdev.* 
            FROM output_devices outdev
            JOIN users_output_devices uoutdev ON outdev.id = uoutdev.output_device_id
            JOIN users u ON uoutdev.user_id = u.id
            WHERE u.id = %s
            """, 
            (user_id,)
        )

        result = cursor.fetchall()

        cursor.close()

        return result

    def get_output_devices_of_users(self, users):
        output_devices = []

        for user in users:
            output_device = self.get_output_devices_of_user(user[0])

            output_devices.append(output_device)

        return output_devices
