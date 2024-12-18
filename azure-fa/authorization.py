import requests
from jose import jwt
from azure.functions import HttpRequest, HttpResponse
import logging

# Configuration for Auth0
AUTH0_DOMAIN = "dev-7u0x4ktpv0rpskm0.us.auth0.com"
API_IDENTIFIER = "http://172.20.10.2:7071/"
ALGORITHMS = ["RS256"]

def verify_jwt(token):
    # Get the public key from Auth0
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    jwks = requests.get(jwks_url).json()
    
    # Get the signing key
    unverified_header = jwt.get_unverified_header(token)
    rsa_key = {}
    for key in jwks['keys']:
        if key['kid'] == unverified_header['kid']:
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"]
            }
            break

    if not rsa_key:
        raise ValueError("Invalid JWT token")

    # Validate the token
    payload = jwt.decode(
        token,
        rsa_key,
        algorithms=ALGORITHMS,
        audience=API_IDENTIFIER,
        issuer=f"https://{AUTH0_DOMAIN}/"
    )
    return payload

def authorize(req: HttpRequest):
    # Check Authorization header
    auth_header = req.headers.get("Authorization", None)
    if not auth_header or not auth_header.startswith("Bearer "):
        return (False, HttpResponse("Authorization header missing or invalid", status_code=401))
    
    token = auth_header.split(" ")[1]
    
    try:
        # Verify the token
        payload = verify_jwt(token)
        logging.info(f"JWT verified for user: {payload}")
        return (True, payload)
    
    except Exception as e:
        logging.error(f"JWT verification failed: {e}")
        return (False, HttpResponse("Unauthorized", status_code=401))
