import httpx
import jwt
import time

# Define APNs parameters
TEAM_ID = "RS528XGBD7"  # Replace with your Apple Developer Team ID
KEY_ID = "8J3KC97C52"    # Replace with your APNs Key ID
CERTIFICATE_FILE = "AuthKey_8J3KC97C52.p8"  # Replace with your .p8 file path
DEVICE_TOKEN = "7f24061ad32b4a5191c9b4289acc67c851f77610299c04fddb967bdef3270b72"
BUNDLE_ID = "com.kalebwbishop.Hazard-Hero"  # Replace with your app's bundle ID
APNS_URL = "https://api.development.push.apple.com/3/device/"  # Use for development; replace with production URL when needed

# Generate the JWT token
def generate_jwt():
    with open(CERTIFICATE_FILE, "r") as f:
        private_key = f.read()
    
    headers = {
        "alg": "ES256",
        "kid": KEY_ID
    }
    payload = {
        "iss": TEAM_ID,
        "iat": time.time()
    }

    token = jwt.encode(payload, private_key, algorithm="ES256", headers=headers)
    return token

# Create the payload
payload = {
    "aps": {
        "alert": {
            "title": "Handicap Sign 1 Requests Assistance",
            "sound": "default"
        },
        "sound": "default"
    }
}

# Send the notification
def notify():
    jwt_token = generate_jwt()
    headers = {
        "apns-topic": BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
        "authorization": f"bearer {jwt_token}"
    }
    
    url = f"{APNS_URL}{DEVICE_TOKEN}"
    
    try:
        with httpx.Client(http2=True) as client:
            response = client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                print("Push notification sent successfully!")
            else:
                print(f"Failed to send notification: {response.status_code} {response.text}")
    except Exception as e:
        print(f"An error occurred: {e}")

# Run the function
if __name__ == "__main__":
    notify()
