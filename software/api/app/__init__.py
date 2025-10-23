from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from app.db import db
from flask import request, jsonify
import requests
import os

from app.routes.bp import bp

migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URI"] # e.g., 'postgresql://user:password@localhost/dbname'
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    migrate.init_app(app, db)  # ← this connects Alembic to your models

    # import models so Alembic can "see" them
    from app.models import base
    from app.models import sign
    from app.models import enums
    from app.models import test_data
    from app.models import user

    @app.get("/health")
    def health():
        db.session.execute(db.text("SELECT 1"))
        return {"ok": True}

    SITE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site')
    app.static_folder = SITE_DIR

    @app.route('/')
    def home():
        return app.send_static_file('index.html')

    app.register_blueprint(bp)

    @app.route('/<path:path>', methods=['GET', 'POST', 'PATCH', 'DELETE'])
    def catch_all(path):
        request_method = request.method
        print(f'Handling {request_method} request for path: {path}')

        headers = {'Content-Type': 'application/json'}

        import base64, os, jwt, time

        secret_b64 = "hx2eKidytOUnkc67dvW8D1Ut4Dqm02mse2G5HbGreOzanQlxga9tt9GCRSDp7+9Ki9CH2ngmZKR3Yu9/Sork0g=="
        secret = base64.b64decode(secret_b64)   # because jwt-secret-is-base64=true

        now = int(time.time())
        payload = {
        "role": "web_anon",      # must be a DB role PostgREST can SET ROLE to
        "aud": "my-api",         # only if you set jwt-aud
        "iat": now,
        "exp": now + 3600
        }
        token = jwt.encode(payload, secret, algorithm="HS256")
        print(token)

        headers['Authorization'] = f'Bearer {token}'


        DB_URL = os.getenv('DB_URL', 'http://127.0.0.1:3000')
        if request_method == 'GET':
            response = requests.get(f'{DB_URL}/{path}', headers=headers, params=request.args.to_dict())
        elif request_method == 'POST':
            response = requests.post(f'{DB_URL}/{path}', json=request.json, headers=headers, params=request.args.to_dict())
        elif request_method == 'PATCH':
            response = requests.patch(f'{DB_URL}/{path}', json=request.json, headers=headers, params=request.args.to_dict())
        elif request_method == 'DELETE':
            response = requests.delete(f'{DB_URL}/{path}', headers=headers, params=request.args.to_dict())
        else:
            return jsonify({'error': 'Method not allowed'}), 405

        print(f'Response status code: {response.status_code}')
        try:
            print(f'Response body: {response.json()}')
        except Exception as e:
            print(f'Error parsing response body: {e}')

        if response.status_code == 200:
            return jsonify(response.json()), response.status_code
        if response.status_code in (204, 201):
            return '', response.status_code
        else:
            return jsonify({'error': 'Not found'}), 404

    return app
