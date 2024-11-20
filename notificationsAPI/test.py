import requests

# Replace with your Firebase Function URL
FIREBASE_FUNCTION_URL = " https://sendpushnotification-4ohy6ququq-uc.a.run.app"

# Replace with a valid FCM device token for testing
DEVICE_TOKEN = "dHlYCRmE_EHxmMgkPecCFV:APA91bHIq-2uU_tXISBizfV8fYX6O04NlE8PDlSPiaxRUBeSR2tN29dGT_tNvt9qWsXYzdxlttpx_Xq6E3E0vPog9nR66evsAa8eCP4t-NS1KjY1N5BNJEQ"

def test_send_push_notification():
    headers = {
        "Content-Type": "application/json"
    }
    data = {
        "token": DEVICE_TOKEN,
        "title": "Test Notification",
        "body": "This is a test push notification sent from Python!"
    }

    try:
        response = requests.post(FIREBASE_FUNCTION_URL, json=data, headers=headers)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        print("Notification sent successfully:", response.json())
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
        print("Response:", response.json())
    except Exception as err:
        print(f"An error occurred: {err}")

# Run the test
test_send_push_notification()
