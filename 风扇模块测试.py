from machine import Pin,PWM  #PWM信号
import time
 
INS = Pin(5, Pin.OUT) #端口接线
pwmS = PWM(INS, freq=1024)  #设置PWM的占空比
while True:
    pwmS.duty(1023)  # 设置PWM占空比
    time.sleep(2)    # 转的时长
    pwmS.duty(500)
    time.sleep(2)    
    pwmS.duty(0) 
    time.sleep(2)