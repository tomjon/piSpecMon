from spectrum.tail import *
import StringIO

def test():
    f = StringIO.StringIO("""2016-10-03 10:01:44,838 - INFO - "GET /monitor HTTP/1.1" 200 -
2016-10-03 10:02:41,003 - DEBUG - No message
2016-10-03 10:03:10,123 - DEBUG - Continue
2016-10-03 10:03:12,412 - INFO - Complete""")

    lines = list(iter_tail(f, 3))
    assert len(lines) == 3
    assert lines[0] == "2016-10-03 10:02:41,003 - DEBUG - No message\n"
    assert lines[-1] == "2016-10-03 10:03:12,412 - INFO - Complete"

    lines = list(iter_tail(f, 2, 'INFO'))
    assert len(lines) == 2
    assert lines[0] == "2016-10-03 10:01:44,838 - INFO - \"GET /monitor HTTP/1.1\" 200 -\n"
    assert lines[-1] == "2016-10-03 10:03:12,412 - INFO - Complete"

    lines = list(iter_tail(f, 1, 'DEBUG'))
    assert len(lines) == 1
    assert lines[0] == "2016-10-03 10:03:10,123 - DEBUG - Continue\n"
