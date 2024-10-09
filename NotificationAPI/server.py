from flask import Flask, jsonify, request

from notify import send_push_notification
from main import NotificationDB

app = Flask(__name__)
notificationDB = NotificationDB()

@app.route('/')
def home():
    return "Welcome to the Notification API!"

@app.route('/notify', methods=['POST'])
def notify_users():
    send_push_notification("ee939ba5182a53662dffef950bbf5a773a9dedb18f26dfa2b5dcff8a8c3c112c")

    return jsonify({"message": "Notification sent"}), 200

    # Get the input_device_id from the request
    data = request.json

    if data is None or not isinstance(data, dict):
        return jsonify({"error": "Invalid data provided"}), 400
    
    input_device_id = data.get('device_id')

    if input_device_id is None:
        return jsonify({"error": "No device_id provided"}), 400
    
    # Notify the users
    users = notificationDB.get_users_of_input_device(0)

    output_devices = notificationDB.get_output_devices_of_users(users)

    return jsonify(output_devices), 200

if __name__ == '__main__':    
    app.run(debug=True)