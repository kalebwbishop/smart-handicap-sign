import logging
import json
from azure.functions import HttpRequest, HttpResponse

from db import connect_to_db, close_connection
from authorization import authorize

def main(req: HttpRequest) -> HttpResponse:
    response = authorize(req)

    if response[0] is not True:
        return response[1]
    
    sub = response[1]["sub"]
    
    # Connect to database
    conn, cur = connect_to_db()

    def GetHSigns():
        try:
            # Fetch user ID based on auth_id
            cur.execute("SELECT user_id FROM users WHERE auth_id = ?", (sub,))
            user = cur.fetchone()

            if not user:
                return HttpResponse("User not found", status_code=404)
            
            # Fetch all hsign_ids associated with the user
            cur.execute("SELECT hsign_id FROM user_hsign_mm WHERE user_id = ?", (user[0],))
            hsigns = cur.fetchall()

            if not hsigns:
                return HttpResponse("No associated handicap signs found", status_code=404)

            # Fetch all hsign details using the hsign_ids
            hsign_ids = tuple(hsign[0] for hsign in hsigns)
            
            # Ensure the IN clause works with a single or multiple IDs
            placeholders = ", ".join("?" * len(hsign_ids))
            query = f"""
                SELECT hsign_id, name, location, status 
                FROM hsigns 
                WHERE hsign_id IN ({placeholders})
            """
            cur.execute(query, hsign_ids)
            hsigns = cur.fetchall()

            # Format response
            response = {}
            for hsign in hsigns:
                response.update({
                    hsign[0]: {
                        "hsign_id": hsign[0],
                        "name": hsign[1],
                        "location": hsign[2],
                        "status": hsign[3]
                    }
                })

            return HttpResponse(json.dumps(response), status_code=200)

        except Exception as e:
            logging.error(f"Error fetching handicap signs: {str(e)}")
            return HttpResponse("Internal Server Error", status_code=500)
    
    response = GetHSigns()
    close_connection(conn, cur)
    return response
