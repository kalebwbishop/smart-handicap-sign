import requests
import json

url = 'http://127.0.0.1:5000/api/input_device_ep'
payload = {
    'classification': True,
    'input_device_id': 'b952a289-9162-4b57-b7c0-556983521695'
}

headers = {
    'Content-Type': 'application/json'
}

response = requests.post(url, data=json.dumps(payload), headers=headers)

print(f'Status Code: {response.status_code}')
print(f'Response Body: {response.text}')