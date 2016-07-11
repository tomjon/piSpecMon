import Hamlib
Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
rig = Hamlib.Rig(501)
rig.state.rigport.parm.serial.stop_bits = 1
rig.state.rigport.write_delay = 50
rig.state.rigport.pathname = '/dev/ttyUSB0'

rig.open()
rig.set_powerstat(0)
print rig.error_status, Hamlib.rigerror(rig.error_status)
