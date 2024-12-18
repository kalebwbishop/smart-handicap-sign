import logging
import json
from azure.functions import HttpRequest, HttpResponse

from db import connect_to_db, close_connection
from authorization import authorize

def main(req: HttpRequest) -> HttpResponse:
    response = authorize(req)

    if response is not True:
        return response
    
    conn, cur = connect_to_db()

    def send_assistance():
        hsign_id = req.get_json().get('hsign_id')

        cur.execute("UPDATE hsigns SET status = 'Ready' WHERE hsign_id = %s", (hsign_id, ))
        conn.commit()

        return HttpResponse(json.dumps({"message": "Assistance sent successfully"}), status_code=200)
    
    response = send_assistance()
    close_connection(conn, cur)

    return response
