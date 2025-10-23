import network
import time
from umqtt.simple import MQTTClient

# Connect to Wi-Fi
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("222 Potomac WiFi", "Everhart12052026")
for _ in range(20):
    if wlan.isconnected():
        break
    time.sleep(0.5)
print("IP:", wlan.ifconfig()[0] if wlan.isconnected() else "not connected")

# MQTT setup
MQTT_BROKER = "2.tcp.ngrok.io"   # public broker
PORT = 19993
CLIENT_ID = "esp32-client"
TOPIC = b"deploybox/test"

# Connect to MQTT broker
client = MQTTClient(CLIENT_ID, MQTT_BROKER, port=PORT)
client.connect()
print("Connected to MQTT broker:", MQTT_BROKER)

# Publish a message
client.publish(TOPIC, b"Hello from DeployBox ESP32!!!")

# Optional: subscribe to messages
def sub_cb(topic, msg):
    print(f"Received message: {msg} on topic: {topic}")

client.set_callback(sub_cb)
client.subscribe(TOPIC)

# Loop to check for new messages
try:
    while True:
        client.check_msg()
        time.sleep(2)
except KeyboardInterrupt:
    client.disconnect()
    print("Disconnected from MQTT broker")
