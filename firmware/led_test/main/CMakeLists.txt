idf_component_register(
    SRCS
        "main.c"
        "led_driver.c"
    INCLUDE_DIRS "." "../../main"
    REQUIRES led_strip
    PRIV_REQUIRES esp_adc esp_timer freertos
)

target_compile_definitions(${COMPONENT_LIB} PRIVATE
    DATA_PIN=${DATA_PIN}
    NUM_LEDS=${NUM_LEDS}
    BRIGHTNESS=${BRIGHTNESS}
)
