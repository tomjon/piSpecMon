from Hamlib import *

myport = hamlib_port_t()
myport.type.rig = RIG_PORT_SERIAL
myport.parm.serial.rate = 19200
myport.parm.serial.data_bits = 8
myport.parm.serial.stop_bits = 2
myport.parm.serial.parity = RIG_PARITY_NONE
myport.parm.serial.handshake = RIG_HANDSHAKE_NONE
myport.pathname = SERIAL_PORT

rig_load_all_backends()
myrig_model = rig_probe(myport)

print myrig_model
