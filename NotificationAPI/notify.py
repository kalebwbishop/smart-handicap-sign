import httpx
import json
import jwt
import time

with open("local_AuthKey.p8", "r") as key_file:
    private_key = key_file.read()

team_id = "RS528XGBD7"
key_id = "9S626A3GYW"
bundle_id = "com.kalebwbishop.Smart-Handicap-Sign"

token = jwt.encode(
    {
        "iss": team_id,
        "iat": time.time(),
    },
    private_key,
    algorithm="ES256",
    headers={"alg": "ES256", "kid": key_id},
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

def send_push_notification(device_token):
    # api.push.apple.com for production
    url = f"https://api.sandbox.push.apple.com/3/device/{device_token}"
    
    headers = {
        "authorization": f"bearer {token}",
        "apns-topic": bundle_id
    }

    with httpx.Client(http2=True) as client:
        response = client.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            print("Push notification sent successfully!")
        else:
            print(f"Failed to send push notification: {response.status_code} {response.text}")


send_push_notification("ee939ba5182a53662dffef950bbf5a773a9dedb18f26dfa2b5dcff8a8c3c112c")

import serial
from time import sleep

if __name__ == "__main__":
    ser = serial.Serial('COM4', 9600, timeout=1)
    sleep(2)

    db_data = None

    with open("local_database.json", "r") as db_file:
        db_data = json.loads(db_file.read())

    while True:
        while ser.in_waiting:
            data = json.loads(ser.readline().decode('utf-8').strip())

            if data["classification"]:

                for user in db_data["devices"][data["device_id"]]["users"]:
                    for notificaiton_device in db_data["users"][user]["notificaiton_devices"]:
                        send_push_notification(notificaiton_device)

                with open("local_database.json", "w") as db_file:
                    db_file.write(json.dumps(db_data, indent=4))

