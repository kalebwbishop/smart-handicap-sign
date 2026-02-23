import machine
import ubinascii


class Photoresistor:
    def __init__(self, adc_pin: int = 34):
        self.adc_pin = adc_pin
        self.adc = machine.ADC(machine.Pin(adc_pin))
        self.adc.atten(machine.ADC.ATTN_11DB)  # ~0–3.3V
        self.adc.width(machine.ADC.WIDTH_12BIT)  # 0–4095

    def read_raw(self) -> int:
        return self.adc.read()


def device_id() -> str:
    return ubinascii.hexlify(machine.unique_id()).decode()
