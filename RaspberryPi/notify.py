import json

def notify(classification, device_id):
    print(json.dumps(
            {
                "classification": classification,
                "device_id": device_id
            }
        ))