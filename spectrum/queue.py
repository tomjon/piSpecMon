""" Module providing a very simple file-system backed message queue. It does not allow for
    concurrency - expects only a single process/thread writing and a single process/thread
    consuming messages.
"""
import os

class Queue(object):
    """ Queue for writing and consuming messages.
    """
    def __init__(self, path):
        self.path = path

    def write(self, message_id, message_text):
        """ Write a message to the queue.
        """
        path0 = os.path.join(self.path, message_id)
        path = path0
        count = 1
        while os.path.exists(path):
            # unlikely, but could happen - concurrency not an issue if only one Queue
            # used to write (otherwise you'd need to use proper file locking)
            path = "{0}{1}".format(path0, count)
            count += 1

        with open(path, 'w') as f:
            f.write(message_text)

    def iter_messages(self):
        """ Consume messages from the queue.
        """
        for message_id in os.listdir(self.path):
            # concurrency not an issue if only one Queue
            # used to consume (otherwise you'd need to use proper file locking)
            path = os.path.join(self.path, message_id)
            with open(path, 'r') as f:
                message_text = f.read()
            os.remove(path)
            yield message_id, message_text
