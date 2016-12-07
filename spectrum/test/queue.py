""" Unit tests for the queue module.
"""
import spectrum.queue

def test(tmpdir):
    """ Rudimentary queue test - messages in/out.
    """
    MESSAGES = (('id1', 'first message'),
                ('id2', 'second message'),
                ('id3', 'third'))

    queue = spectrum.queue.Queue(str(tmpdir))
    for message in MESSAGES:
        queue.write(*message)

    output = list(queue.iter_messages())
    assert len(output) == 3
    for message in MESSAGES:
        assert message in output
