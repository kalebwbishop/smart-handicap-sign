idf_component_register(
    SRCS
        "main.c"
        "connection_policy.c"
        "adc_sampler.c"
        "nvs_storage.c"
        "led_driver.c"
        "wifi_manager.c"
        "provisioning_server.c"
        "https_client.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_adc esp_driver_gpio esp_event esp_http_client esp_http_server esp_netif esp_timer esp_wifi json mbedtls nvs_flash
)

target_compile_definitions(${COMPONENT_LIB} PRIVATE HAZARD_HERO_BACKEND_URL="${HAZARD_HERO_BACKEND_URL}")
