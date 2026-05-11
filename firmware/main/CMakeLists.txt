idf_component_register(
    SRCS
        "main.c"
        "adc_sampler.c"
        "nvs_storage.c"
        "led_driver.c"
        "wifi_manager.c"
        "provisioning_server.c"
        "https_client.c"
        "ota_update.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_adc esp_driver_gpio esp_event esp_http_client esp_http_server esp_netif esp_timer esp_wifi json nvs_flash app_update esp_https_ota
    EMBED_TXTFILES "${PROJECT_DIR}/server_certs/ca_cert.pem"
)

target_compile_definitions(${COMPONENT_LIB} PRIVATE HAZARD_HERO_BACKEND_URL="${HAZARD_HERO_BACKEND_URL}")
