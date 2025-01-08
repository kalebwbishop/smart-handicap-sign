import requests
import dotenv
import os
import psutil
import hashlib

dotenv.load_dotenv()

class Notify:
    def __init__(self):
        self.ACCESS_TOKEN = None
        self.IDENTIFIER = None
        self.CLIENT_ID = os.getenv("CLIENT_ID")
        self.CLIENT_SECRET = os.getenv("CLIENT_SECRET")
        self.AUDIENCE = os.getenv("AUDIENCE")
        self.__get_access_token()
        self.__generate_identifier()

    def __get_access_token(self):
        url = "https://dev-7u0x4ktpv0rpskm0.us.auth0.com/oauth/token"
        
        payload = {
            "client_id": self.CLIENT_ID,
            "client_secret": self.CLIENT_SECRET,
            "audience": self.AUDIENCE,
            "grant_type": "client_credentials"
        }
        
        headers = { 'content-type': "application/json" }
        
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        self.ACCESS_TOKEN = response.json().get('access_token')
    
    def __generate_identifier(self):
        # Get the MAC address
        mac = psutil.net_if_addrs()['wlan0'][0].address

        # Generate the token
        hexdigest = hashlib.md5(mac.encode()).hexdigest()
        
        # Convert into an integer
        self.IDENTIFIER = int(hexdigest[:8], 16)

    def notify(self):
        url = "http://192.168.4.243:7071/api/processiotmessage"
        
        headers = {
            'Authorization': f"Bearer {self.ACCESS_TOKEN}",
            'Content-Type': "application/json"
        }

        data = {
            "hsign_id": self.IDENTIFIER,
            }
        
        response = requests.post(url, json=data, headers=headers)
        print(response.status_code)
        print(response.text)

if __name__ == '__main__':
    notifyObj = Notify()
    notifyObj.notify()

