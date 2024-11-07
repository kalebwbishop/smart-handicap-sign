from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from dotenv import load_dotenv
import os

from models import db
from services.notify_service import NotifyService

load_dotenv()

DATABASE_URI = f'postgresql://{os.getenv("DB_USER")}:{os.getenv("DB_PASS")}@{os.getenv("DB_HOST")}:{os.getenv("DB_PORT")}/{os.getenv("DB_NAME")}' 

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URI
db.init_app(app)
migrate = Migrate(app, db)

# Root route
@app.route('/')
def home():
    return jsonify({'message': 'a85e9341-0a8f-4426-947b-d94e65e8376f'})

# Route for POST request example
@app.route('/api/input_device_ep', methods=['POST'])
def input_device_ep():
    try:
        notify_service = NotifyService(request)

        input_device_id = notify_service.get_input_device_id()
        user_ids = notify_service.get_users_of_input_device(input_device_id)
        output_device_ids = notify_service.get_output_devices_of_user_ids(user_ids)
        output_device_tokens = notify_service.get_device_tokens_of_output_device_ids(output_device_ids)
        notify_service.notify_users(output_device_tokens)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({
            "status": "Success",
            "message": "Notification(s) sent successfully",
            "dev": f"{output_device_tokens}"
        })

if __name__ == '__main__':
    app.run(debug=True)
