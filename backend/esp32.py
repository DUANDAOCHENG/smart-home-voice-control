import network
import time
import ujson
from machine import Pin, PWM
from umqtt.simple import MQTTClient
try:
    import urequests
except Exception:
    urequests = None

# 1) Wi-Fi 配置
WIFI_SSID = "DDC"
WIFI_PASSWORD = "224674266Dd"

# 2) MQTT 配置（与后端保持一致）
MQTT_BROKER = "192.168.0.3"
MQTT_PORT = 1883
MQTT_CLIENT_ID_BASE = "esp32_light_01"
MQTT_TOPIC_LIGHT = b"smart_home/light/state"
MQTT_TOPIC_FAN = b"smart_home/fan/state"
BACKEND_SYNC_BASE = "http://192.168.0.3:3000/api/mqtt"

# 如无需鉴权可留空
MQTT_USER = "ddc"
MQTT_PASS = "Ddc@2026mqtt!"

# 3) 硬件引脚（按你的接线调整）
LIGHT_PIN = 2
FAN_PIN = 5

# 风扇 PWM 参数（根据实际风扇模块可再微调）
FAN_PWM_FREQ = 1024
FAN_DUTY_HIGH = 420  # 常用档
FAN_DUTY_IDLE = 0 # 低速待机（不断转）
PING_INTERVAL_MS = 15000

led = Pin(LIGHT_PIN, Pin.OUT)
fan_pwm = PWM(Pin(FAN_PIN, Pin.OUT), freq=FAN_PWM_FREQ)
fan_pwm.duty(FAN_DUTY_IDLE)


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Connecting WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        retry = 20
        while not wlan.isconnected() and retry > 0:
            time.sleep(1)
            retry -= 1
    if not wlan.isconnected():
        raise Exception("WiFi connect failed")
    print("WiFi connected:", wlan.ifconfig())


def on_message(topic, msg):
    print("MQTT recv:", topic, msg)
    try:
        data = ujson.loads(msg)
        value = int(data.get("value", 0))
        if topic == MQTT_TOPIC_LIGHT:
            led.value(1 if value == 1 else 0)
            print("LIGHT state:", value)
        elif topic == MQTT_TOPIC_FAN:
            # 你的要求是风扇不需要停转：on=高速，off=低速待机
            duty = FAN_DUTY_HIGH if value == 1 else FAN_DUTY_IDLE
            fan_pwm.duty(duty)
            print("FAN duty:", duty)
    except Exception as e:
        print("Parse message failed:", e)


def create_mqtt_client():
    # 部分情况下固定 client_id 会导致 broker 判定冲突并断开，这里加时间戳后缀避免重连抖动
    client_id = "{}_{}".format(MQTT_CLIENT_ID_BASE, time.ticks_ms() & 0xFFFF)
    client = MQTTClient(
        client_id=client_id,
        server=MQTT_BROKER,
        port=MQTT_PORT,
        user=MQTT_USER if MQTT_USER else None,
        password=MQTT_PASS if MQTT_PASS else None,
        keepalive=30,
    )
    client.set_callback(on_message)
    client.connect()
    client.subscribe(MQTT_TOPIC_LIGHT)
    client.subscribe(MQTT_TOPIC_FAN)
    print("Subscribed:", MQTT_TOPIC_LIGHT, MQTT_TOPIC_FAN)
    return client


def request_backend_sync():
    # ESP32 每次连上 MQTT 后主动请求后端按数据库最新值重发，避免吃到历史 retain 旧值
    if urequests is None:
        print("Skip sync: urequests not available")
        return
    for path in ("/sync-light", "/sync-fan"):
        url = BACKEND_SYNC_BASE + path
        try:
            resp = urequests.post(url)
            print("Sync request:", path, "status=", resp.status_code)
            resp.close()
        except Exception as e:
            print("Sync request failed:", path, e)


def main():
    wlan = connect_wifi()
    client = create_mqtt_client()
    request_backend_sync()
    last_ping = time.ticks_ms()
    while True:
        try:
            # 无消息期间也主动发心跳，降低 broker 因空闲断链的概率
            if time.ticks_diff(time.ticks_ms(), last_ping) >= PING_INTERVAL_MS:
                client.ping()
                last_ping = time.ticks_ms()
            client.check_msg()
            time.sleep_ms(200)
        except Exception as e:
            print("MQTT loop error:", e)
            time.sleep(2)
            if not wlan.isconnected():
                wlan = connect_wifi()
            try:
                client.disconnect()
            except Exception:
                pass
            client = create_mqtt_client()
            request_backend_sync()
            last_ping = time.ticks_ms()


main()
