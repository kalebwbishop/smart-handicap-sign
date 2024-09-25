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
