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

    if response[0] is False:
        return response[1]
    
    conn, cur = connect_to_db()

    def process_iot_message():
        try:
            hsign_id = req.get_json().get("hsign_id")

            # Set the handicap sign status to 'Assist'
            cur.execute("UPDATE hsigns SET status = 'Assist' WHERE hsign_id = ?", (hsign_id,))

            # Get the user IDs associated with the handicap sign
            cur.execute("SELECT user_id FROM user_hsign_mm WHERE hsign_id = ?", (hsign_id,))
            user_ids = cur.fetchall()

            if not user_ids:
                return HttpResponse(
                    json.dumps({
                        "status": "error",
                        "message": "No users found for this handicap sign."
                    }), status_code=404
                )

            # Prepare list of user IDs for IN clause
            user_ids_str = ", ".join(str(x[0]) for x in user_ids)
            cur.execute(f"SELECT output_device_id FROM user_output_device_mm WHERE user_id IN ({user_ids_str})")
            output_device_ids = cur.fetchall()

            if not output_device_ids:
                return HttpResponse(
                    json.dumps({
                        "status": "error",
                        "message": "No output devices found for the users."
                    }), status_code=404
                )

            # Prepare list of output device IDs for IN clause
            output_device_ids_str = ", ".join(str(x[0]) for x in output_device_ids)
            cur.execute(f"SELECT expo_push_token FROM output_devices WHERE output_device_id IN ({output_device_ids_str})")
            
            expo_tokens = cur.fetchall()

            for token_row in expo_tokens:
                expo_push_token = token_row[0]
                
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
                            json.dumps({
                                "status": "error",
                                "message": "Invalid Expo push token provided.",
                            }), status_code=400
                        )

                    def send_push_message(token, message):
                        try:
                            PushClient().publish(
                                PushMessage(to=token, body=message, data={
                                    "hsign_id": str(hsign_id), 
                                    "location": "Emergency Room", 
                                    "name": str(hsign_id), 
                                    "status": "Assist"
                                })
                            )
                            logging.info(f"Push notification sent to {token}")
                            conn.commit()  # Explicit commit
                        except Exception as exc:
                            logging.error(f"Unexpected error sending push notification: {exc}")
                            raise

                    # Send a push notification
                    try:
                        send_push_message(expo_push_token, "Hello, World!")
                        return HttpResponse(
                            json.dumps({
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
                        }), status_code=400
                    )
        except Exception as e:
            logging.exception("Error processing IoT message")
            return HttpResponse(
                json.dumps({
                    "status": "error",
                    "message": str(e)
                }), status_code=500
            )

    response = process_iot_message()
    close_connection(conn, cur)

    return response
