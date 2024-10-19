from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "Welcome to the API!"})

@app.route('/api/data', methods=['GET'])
def get_data():
    data = {
        "id": 1,
        "name": "Sample Data"
    }
    return jsonify(data)

@app.route('/api/data', methods=['POST'])
def create_data():
    new_data = request.get_json()
    return jsonify(new_data), 201

if __name__ == '__main__':
    app.run('172.20.10.3', debug=True)