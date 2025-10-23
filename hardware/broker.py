import asyncio
from amqtt.broker import Broker

# Minimal, open (no-auth) config for local/dev use
BROKER_CONFIG = {
    "listeners": {
        "default": {
            "type": "tcp",
            "bind": "0.0.0.0:1883"  # standard MQTT port
        }
    },
    # Emit $SYS messages every 10s (optional)
    "sys_interval": 10,
    # No auth/persistence by default; great for local testing
}

broker: Broker | None = None

async def start():
    global broker
    broker = Broker(BROKER_CONFIG)
    await broker.start()

async def shutdown():
    if broker:
        await broker.shutdown()

def main():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        print("MQTT Broker starting on port 1883...")
        # Run startup synchronously so exceptions are raised here
        loop.run_until_complete(start())
        print("Press Ctrl+C to stop")
        loop.run_forever()
    except KeyboardInterrupt:
        print("\nShutting down broker...")
        loop.run_until_complete(shutdown())
    finally:
        loop.close()

if __name__ == "__main__":
    main()
