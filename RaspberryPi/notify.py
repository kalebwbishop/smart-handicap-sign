import json
import requests

still_alive_counter = 8

# NOTIFICATION_API_URL = "https://smart-handicap-sign.azurewebsites.net/api/input_device_ep"
NOTIFICATION_API_URL = "https://7tb1sv50-5000.use.devtunnels.ms/api/input_device_ep"


def notify(classification, device_id):
    global still_alive_counter
    
    # Send to the notification API
    headers = {'Content-Type': 'application/json'}
    print(requests.post(NOTIFICATION_API_URL, json={
                "trigger": 1,
                "input_device_id": device_id
            }, headers=headers).text)
    
