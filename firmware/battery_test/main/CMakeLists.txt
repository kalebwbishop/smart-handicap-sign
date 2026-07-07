idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_adc esp_timer freertos
)

target_compile_definitions(${COMPONENT_LIB} PRIVATE
    BATTERY_TEST_ADC_CHANNEL=${BATTERY_TEST_ADC_CHANNEL}
    BATTERY_TEST_SAMPLE_INTERVAL_MS=${BATTERY_TEST_SAMPLE_INTERVAL_MS}
)
