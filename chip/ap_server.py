from flask import Flask, request, jsonify
import os
import subprocess

app = Flask(__name__)

def get_ip_address():
    try:
        # Use the `ip` command to fetch the IP address of wlan0
        result = subprocess.run(['ip', '-4', 'addr', 'show', 'wlan0'], stdout=subprocess.PIPE)
        output = result.stdout.decode('utf-8')
        for line in output.split('\n'):
            line = line.strip()
            if line.startswith('inet'):
                ip_address = line.split()[1].split('/')[0]  # Extract the IP address
                return ip_address
        return "No IP address found"
    except Exception as e:
        print(f"Error retrieving IP address: {e}")
        return "Unable to retrieve IP"
    

# Save Wi-Fi credentials and restart the Wi-Fi service
def save_wifi_credentials(ssid, password):
    try:
        config = f"""
        country=US
        ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
        update_config=1
        network={{
            ssid="{repr(ssid)}"
            psk="{repr(password)}"
        }}
        """
        with open('/etc/wpa_supplicant/wpa_supplicant.conf', 'w') as file:
            file.write(config)
        os.system('sudo systemctl restart dhcpcd.service')
        return True, "Wi-Fi credentials saved successfully"
    except Exception as e:
        print(f"Error saving Wi-Fi credentials: {e}")
        return False, f"Error saving Wi-Fi credentials: {e}"

# Stop Access Point (AP) services
def stop_access_point():
    os.system('sudo systemctl stop hostapd')
    os.system('sudo systemctl stop dnsmasq')

# Restart Access Point (AP) services
def restart_access_point():
    os.system('sudo systemctl start hostapd')
    os.system('sudo systemctl start dnsmasq')

# Check if the Raspberry Pi is connected to the internet
def check_connection():
    try:
        # Ping a reliable public DNS server
        result = subprocess.run(['ping', '-c', '1', '8.8.8.8'], stdout=subprocess.PIPE)
        return result.returncode == 0
    except Exception as e:
        print(f"Error checking connection: {e}")
        return False

# Get a list of available Wi-Fi networks
def scan_wifi():
    try:
        result = subprocess.run(['sudo', 'iwlist', 'wlan0', 'scan'], stdout=subprocess.PIPE)
        output = result.stdout.decode('utf-8')
        networks = []
        for line in output.split('\n'):
            line = line.strip()
            if line.startswith('ESSID:'):
                ssid = line.split('"')[1]  # Extract the SSID
                networks.append(ssid)
        return networks
    except Exception as e:
        print(f"Error scanning Wi-Fi networks: {e}")
        return []

@app.route('/set_wifi', methods=['POST'])
def set_wifi():
    data = request.json
    ssid = data.get('ssid')
    password = data.get('password')

    if not ssid or not password:
        return jsonify({"error": "SSID and password are required"}), 400

    saved_wifi_credentials, message = save_wifi_credentials(ssid, password)

    if saved_wifi_credentials:
        if check_connection():
            # stop_access_point()
            ip_address = get_ip_address()
            print(f"Wi-Fi setup successful, IP address: {ip_address}")
            return jsonify({"status": "Wi-Fi setup successful, Access Point turned off"}), 200
        else:
            restart_access_point()
            return jsonify({"error": "Failed to connect to Wi-Fi, Access Point restarted"}), 500
    else:
        return jsonify({"error": message}), 500

@app.route('/check-connection', methods=['GET'])
def connection_status():
    if check_connection():
        return jsonify({"status": "connected"}), 200
    else:
        return jsonify({"status": "not connected"}), 500

@app.route('/scan-wifi', methods=['GET'])
def scan_wifi_endpoint():
    networks = scan_wifi()
    return jsonify({"available_networks": networks}), 200

@app.route('/restart', methods=['GET'])
def restart():
    restart_access_point()
    return jsonify({"status": "Access Point restarted"}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
