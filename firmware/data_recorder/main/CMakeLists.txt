idf_component_register(
    SRCS
        "main.c"
        "adc_sampler.c"
        "wifi_manager.c"
    INCLUDE_DIRS "." 
    PRIV_REQUIRES esp_adc esp_event esp_http_client esp_netif esp_timer esp_wifi cjson nvs_flash
)
