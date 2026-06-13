if(NOT DEFINED DPS_ID_SCOPE)
    set(DPS_ID_SCOPE "")
endif()
if(NOT DEFINED DPS_REGISTRATION_ID)
    set(DPS_REGISTRATION_ID "")
endif()
if(NOT DEFINED IOT_HUB_MQTT_PORT)
    set(IOT_HUB_MQTT_PORT 8883)
endif()
if(NOT DEFINED IOT_HUB_API_VERSION)
    set(IOT_HUB_API_VERSION "2021-04-12")
endif()

idf_component_register(
    SRCS
        "main.c"
        "connection_policy.c"
        "adc_sampler.c"
        "nvs_storage.c"
        "led_driver.c"
        "wifi_manager.c"
        "provisioning_server.c"
        "iot_hub_client.c"
        "dps_client.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_adc esp_driver_gpio esp_event esp_http_client esp_http_server esp_netif esp_timer esp_wifi json mbedtls mqtt nvs_flash
    EMBED_TXTFILES
        "device.cert.pem"
        "device.key.pem"
)

target_compile_definitions(${COMPONENT_LIB} PRIVATE
    DPS_ID_SCOPE="${DPS_ID_SCOPE}"
    DPS_REGISTRATION_ID="${DPS_REGISTRATION_ID}"
    IOT_HUB_MQTT_PORT=${IOT_HUB_MQTT_PORT}
    IOT_HUB_API_VERSION="${IOT_HUB_API_VERSION}"
)
