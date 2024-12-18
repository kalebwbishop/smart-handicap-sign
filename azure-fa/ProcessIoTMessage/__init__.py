import logging
from exponent_server_sdk import (
    PushClient,
    PushMessage,
)
from azure.functions import HttpRequest, HttpResponse
import json

from db import connect_to_db, close_connection
from authorization import authorize

def main(req: HttpRequest) -> HttpResponse:
    response = authorize(req)

    if response is not True:
        return response
    
    conn, cur = connect_to_db()

    def process_iot_message():
        hsign_id = req.get_json().get("hsign_id")

        # Set the handicap sign status to 'Assist'
        cur.execute("UPDATE hsigns SET status = 'Assist' WHERE hsign_id = %s", (hsign_id,))

        # Get the user IDs associated with the handicap sign
        cur.execute("SELECT user_id FROM user_hsign_mm WHERE hsign_id = %s", (hsign_id,))
        user_ids = cur.fetchall()

        # Get the output device IDs associated with the users
        cur.execute("SELECT output_device_id FROM user_output_device_mm WHERE user_id IN (%s)", (", ".join([str(x[0]) for x in user_ids]),))
        output_device_ids = cur.fetchall()

        # Get the tokens associated with the output devices
        cur.execute("SELECT expo_push_token FROM output_devices WHERE output_device_id IN (%s)", (", ".join([str(x[0]) for x in output_device_ids]),))
        for expo_push_token in cur.fetchall():
            expo_push_token = expo_push_token[0]
            if not expo_push_token:
                try:
                    req_body = req.get_json()
                except ValueError:
                    req_body = {}
                expo_push_token = req_body.get("token")

            if expo_push_token:
                # Ensure the token is an Expo Push Token
                if not expo_push_token.startswith("ExponentPushToken"):
                    logging.error(f"Invalid Expo push token: {expo_push_token}")
                    return HttpResponse(
                        json.dumps(
                        {
                            "status": "error",
                            "message": "Invalid Expo push token provided.",
                        }), status_code=400
                    )

                def send_push_message(token, message):
                    try:
                        PushClient().publish(
                            PushMessage(to=token, body=message, data={"hsign_id": "1", "location": "Emergency Room", "name": "1", "status": "Assist"})
                        )
                        logging.info(f"Push notification sent to {token}")
                        conn.commit()

                    except Exception as exc:
                        logging.error(f"Unexpected error sending push notification: {exc}")
                        raise

                # Send a push notification
                try:
                    send_push_message(expo_push_token, "Hello, World!")
                    return HttpResponse(
                        json.dumps(
                        {
                            "status": "success",
                            "message": f"Notification sent to {expo_push_token}."
                        }), status_code=200
                    )
                except Exception:
                    return HttpResponse(
                        json.dumps({
                            "status": "error",
                            "message": "Failed to send push notification."
                        }), status_code=500
                    )
            else:
                return HttpResponse(
                    json.dumps({
                        "status": "error",
                        "message": "No Expo push token provided."
                    }), status_code=400,
                )
            
    response = process_iot_message()
    close_connection(conn, cur)

    return response