#pragma once

/*
 * These PEM files are embedded by CMake through EMBED_TXTFILES.
 * Replace certs/device.cert.pem and certs/device.key.pem with the real device
 * leaf certificate chain and private key before building a real image.
 */
extern const unsigned char device_cert_pem_start[] asm("_binary_device_cert_pem_start");
extern const unsigned char device_cert_pem_end[] asm("_binary_device_cert_pem_end");
extern const unsigned char device_key_pem_start[] asm("_binary_device_key_pem_start");
extern const unsigned char device_key_pem_end[] asm("_binary_device_key_pem_end");

#define DEVICE_CERT_PEM ((const char *)device_cert_pem_start)
#define DEVICE_KEY_PEM ((const char *)device_key_pem_start)
