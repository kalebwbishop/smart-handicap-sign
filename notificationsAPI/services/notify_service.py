from dotenv import load_dotenv
import httpx
import jwt
import time
import os
import base64

from services.database_service import DatabaseService
import smtplib
from email.mime.text import MIMEText

load_dotenv()

class NotifyService:
    """
    Steps to notify users upon device request:
    
    1. Get the input_device_id from the request
    2. Get the coresponding owner(s) of the input_device_id
    3. Get the output_devices of the owner(s)
    4. Notify the owner(s) via their output_devices
    """

    __TEAM_ID = os.getenv("APPLE_TEAM_ID")
    __KEY_ID = os.getenv("APPLE_KEY_ID")
    __BUNDLE_ID = os.getenv("APPLE_BUNDLE_ID")
    __AUTH_KEY = base64.b64decode(os.getenv("APPLE_AUTH_KEY"))

    token = jwt.encode(
        {
            "iss": __TEAM_ID,
            "iat": time.time(),
        },
        __AUTH_KEY,
        algorithm="ES256",
        headers={"alg": "ES256", "kid": __KEY_ID},
    )

    payload = {
        "aps": {
            "alert": {
                "title": "Hello!",
                "body": "This is a test push notification."
            },
            "sound": "default"
        }
    }

    def __init__(self, req):
        try:
            self.req = req.get_json()
        except ValueError:
            raise ValueError("JSON data not provided")
        
        self.database_service = DatabaseService()

        print(self.database_service.execute_fetchall_query(
            f"""
            SELECT * FROM output_devices
            """))    

    def get_input_device_id(self):
        data = self.req

        if data is None or not isinstance(data, dict):
            raise ValueError("Invalid data provided")
        
        input_device_id = data.get('input_device_id')

        if input_device_id is None:
            raise ValueError("Invalid input device id provided")
        
        return input_device_id
    
    def get_users_of_input_device(self, input_device_id):
        result = self.database_service.execute_fetchall_query(
            f"""
            SELECT user_id FROM users_MM_input_devices WHERE input_device_id = '{input_device_id}'
            """)
        
        result = [row[0] for row in result]

        return result

    def get_output_devices_of_user_ids(self, user_ids):
        if not user_ids:
            return []
        
        joined_user_ids = ", ".join([f"'{user_id}'" for user_id in user_ids])
        
        result = self.database_service.execute_fetchall_query(
            f"""
            SELECT output_device_id FROM users_MM_output_devices WHERE user_id IN ({joined_user_ids})
            """)
        
        result = [row[0] for row in result]

        return result
    
    def get_output_devices_of_output_device_ids(self, output_device_ids):
        if not output_device_ids:
            return []
        
        joined_ouput_device_ids = ", ".join([f"'{ouput_device_id}'" for ouput_device_id in output_device_ids])
        
        result = self.database_service.execute_fetchall_query(
            f"""
            SELECT identifier_type, identifier_value FROM output_devices WHERE id IN ({joined_ouput_device_ids})
            """)
        
        return result

    def notify_users(self, output_devices):
        iphone_app_users = []
        android_app_users = []
        text_message_users = []

        for output_device in output_devices:
            identifier_type, identifier_value = output_device

            if identifier_type == 'IPHONE_APP':
                iphone_app_users.append(identifier_value)
            elif identifier_type == 'ANDROID_APP':
                android_app_users.append(identifier_value)
            elif identifier_type == 'TEXT_MESSAGE':
                text_message_users.append(identifier_value)

        self.__notify_iphone_app_users(iphone_app_users)
        self.__notify_android_app_users(android_app_users)
        self.__notify_text_message_users(text_message_users)
            

    def __notify_iphone_app_users(self, identifier_values):
        if not identifier_values:
            return
        
        # api.push.apple.com for production
        for identifier_value in identifier_values:
            url = f"https://api.sandbox.push.apple.com/3/device/{identifier_value}"
            
            headers = {
                "authorization": f"bearer {NotifyService.token}",
                "apns-topic": NotifyService.__BUNDLE_ID
            }

            with httpx.Client(http2=True) as client:
                response = client.post(url, headers=headers, json=NotifyService.payload)
                if response.status_code == 200:
                    print("Push notification sent successfully!")
                else:
                    print(f"Failed to send push notification: {response.status_code} {response.text}")

    def __notify_android_app_users(self, identifier_value):
        if not identifier_value:
            return

    def __notify_text_message_users(self, identifier_values):
        if not identifier_values:
            return
        
        # Email content
        for identifier_value in identifier_values:
            msg = MIMEText("May the force be with you!")
            msg["From"] = os.getenv("EMAIL_ADDRESS")
            msg["To"] = identifier_value

            # SMTP server configuration
            smtp_server = os.getenv("SMTP_SERVER")
            smtp_port = os.getenv("SMTP_PORT")
            smtp_user = os.getenv("EMAIL_ADDRESS")
            smtp_password = os.getenv("SMTP_PASSWORD")
            smtp_password = "pimd naon brdk wwys"

            try:
                with smtplib.SMTP(smtp_server, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.sendmail(msg["From"], [msg["To"]], msg.as_string())
                    print("Text message sent successfully!")
            except Exception as e:
                print(f"Failed to send text message: {e}")



if __name__ == '__main__':
    NotifyService.notify_users(None, ['ee939ba5182a53662dffef950bbf5a773a9dedb18f26dfa2b5dcff8a8c3c112c'])