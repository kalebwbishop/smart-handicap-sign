#!/usr/bin/env python3

import argparse
import json
import sys
import time
from datetime import datetime, timezone

# python mock_dps_x509_device.py --id-scope <DPS ID SCOPE> --registration-id <REGISTRATION ID> --cert <PATH TO CERT PEM> --key <PATH TO KEY PEM> [--pass-phrase <KEY PASSPHRASE>] [--no-telemetry]
# python mock_dps_x509_device.py --id-scope 0ne012134E0 --registration-id SHS-2605-S01-A7K-00001-J --cert "private\SHS-2605-S01-A7K-00001-J.cert.pem" --key "private\SHS-2605-S01-A7K-00001-J.key.pem"

from azure.iot.device import (
    ProvisioningDeviceClient,
    IoTHubDeviceClient,
    Message,
    X509,
)


DPS_GLOBAL_ENDPOINT = "global.azure-devices-provisioning.net"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_x509(cert_file: str, key_file: str, pass_phrase: str | None) -> X509:
    return X509(
        cert_file=cert_file,
        key_file=key_file,
        pass_phrase=pass_phrase,
    )


def provision_device(
    id_scope: str,
    registration_id: str,
    cert_file: str,
    key_file: str,
    pass_phrase: str | None,
):
    print("Creating X.509 credential...")
    x509 = build_x509(cert_file, key_file, pass_phrase)

    print("Connecting to DPS...")
    print(f"  DPS endpoint:     {DPS_GLOBAL_ENDPOINT}")
    print(f"  ID Scope:         {id_scope}")
    print(f"  Registration ID:  {registration_id}")
    print(f"  Cert file:        {cert_file}")
    print(f"  Key file:         {key_file}")

    provisioning_client = ProvisioningDeviceClient.create_from_x509_certificate(
        provisioning_host=DPS_GLOBAL_ENDPOINT,
        registration_id=registration_id,
        id_scope=id_scope,
        x509=x509,
    )

    print("Registering device with DPS...")
    result = provisioning_client.register()

    print("\nDPS registration result:")
    print(f"  Status: {result.status}")

    if result.status != "assigned":
        raise RuntimeError(f"DPS did not assign the device. Status: {result.status}")

    assigned_hub = result.registration_state.assigned_hub
    assigned_device_id = result.registration_state.device_id

    print("\nAssigned by DPS:")
    print(f"  IoT Hub:   {assigned_hub}")
    print(f"  Device ID: {assigned_device_id}")

    return assigned_hub, assigned_device_id, x509


def connect_to_iot_hub(
    assigned_hub: str,
    device_id: str,
    x509: X509,
):
    print("\nConnecting to assigned IoT Hub...")

    device_client = IoTHubDeviceClient.create_from_x509_certificate(
        hostname=assigned_hub,
        device_id=device_id,
        x509=x509,
    )

    device_client.connect()

    print("Connected to IoT Hub.")
    return device_client


def send_test_telemetry(device_client: IoTHubDeviceClient, registration_id: str):
    payload = {
        "messageType": "mockTelemetry",
        "registrationId": registration_id,
        "timestampUtc": utc_now_iso(),
        "source": "python-x509-dps-mock",
        "temperatureC": 22.5,
        "batteryPct": 87,
    }

    message = Message(json.dumps(payload))
    message.content_encoding = "utf-8"
    message.content_type = "application/json"

    message.custom_properties["messageType"] = "mockTelemetry"
    message.custom_properties["source"] = "python-x509-dps-mock"

    print("\nSending telemetry:")
    print(json.dumps(payload, indent=2))

    device_client.send_message(message)

    print("Telemetry sent.")


def main():
    parser = argparse.ArgumentParser(
        description="Mock Azure DPS X.509 device registration and IoT Hub telemetry test."
    )

    parser.add_argument(
        "--id-scope",
        required=True,
        help="DPS ID Scope from the DPS Overview page.",
    )

    parser.add_argument(
        "--registration-id",
        required=True,
        help="Device registration ID. Usually matches the device certificate CN.",
    )

    parser.add_argument(
        "--cert",
        required=True,
        help="Path to device certificate PEM. Prefer leaf cert + intermediate chain PEM.",
    )

    parser.add_argument(
        "--key",
        required=True,
        help="Path to device private key PEM.",
    )

    parser.add_argument(
        "--pass-phrase",
        default=None,
        help="Optional private key pass phrase.",
    )

    parser.add_argument(
        "--no-telemetry",
        action="store_true",
        help="Only provision through DPS; do not connect/send telemetry to IoT Hub.",
    )

    args = parser.parse_args()

    device_client = None

    try:
        assigned_hub, assigned_device_id, x509 = provision_device(
            id_scope=args.id_scope,
            registration_id=args.registration_id,
            cert_file=args.cert,
            key_file=args.key,
            pass_phrase=args.pass_phrase,
        )

        if args.no_telemetry:
            print("\nDPS test completed successfully.")
            return 0

        device_client = connect_to_iot_hub(
            assigned_hub=assigned_hub,
            device_id=assigned_device_id,
            x509=x509,
        )

        send_test_telemetry(device_client, args.registration_id)

        print("\nMock device test completed successfully.")
        return 0

    except Exception as exc:
        print("\nERROR:")
        print(f"  {exc}")
        return 1

    finally:
        if device_client is not None:
            try:
                print("\nDisconnecting from IoT Hub...")
                device_client.disconnect()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())