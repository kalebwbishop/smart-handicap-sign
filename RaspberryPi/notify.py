import json
import requests

still_alive_counter = 8

NOTIFICATION_API_URL = "http://127.0.0.1:5000/notify"

def notify(classification, device_id):
    global still_alive_counter
    
    # TODO: Make this send to the notification API
    headers = {'Content-Type': 'application/json'}
    print(requests.post(NOTIFICATION_API_URL, json={
                "classification": classification,
                "device_id": device_id
            }, headers=headers).text)
    
if __name__ == "__main__":
    notify(True, 1)
