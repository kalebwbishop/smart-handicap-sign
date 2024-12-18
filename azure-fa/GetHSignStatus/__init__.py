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

    def get_hsign_status():
        hsign_id = req.get_json().get('hsign_id')

        cur.execute("SELECT status FROM hsigns WHERE hsign_id = %s", (hsign_id, ))
        status = cur.fetchone()

        return HttpResponse(json.dumps({"status": status[0]}), status_code=200)

    response = get_hsign_status()
    close_connection(conn, cur)

    return response