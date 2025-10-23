import requests
from flask import Blueprint, jsonify
from app.models import User
from app.email_templates import get_email_template
import os

bp = Blueprint('bp', __name__)

@bp.route('/v1/notify')
def notify_v1():
    # Get all users with an active email
    active_users = User.query.filter_by(email_is_active=True).all()

    if not active_users:
        return jsonify({'message': 'No active users found.'}), 404

    user_emails = [user.email for user in active_users]

    email_template = get_email_template("assistance_needed.html")

    url = os.getenv('NOTIFICATION_SERVICE_URL', 'https://deploy-box-apis-func-dev.azurewebsites.net/api/v1/email')

    headers = {
        "Content-Type": "application/json",
    }

    json_data = {
        "to_emails": user_emails,
        "subject": "Testing",
        "html_content": email_template
    }

    response = requests.post(url, headers=headers, json=json_data, verify=False)

    if response.status_code == 200:
        return jsonify({'message': 'Notification sent!'})
    else:
        print(response.text)
        return jsonify({'error': 'Failed to send notification'}), 500
