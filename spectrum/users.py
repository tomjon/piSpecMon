from config import *
from common import *
import hashlib
import binascii
import os
import os.path
import tempfile


class UsersError(Exception):
    """ Generic exception for this module.
    """
    pass


class UnitialisedError(UsersError):
    """ Raised when the username/password file does not exist.
    """
    pass


class InvalidUsername(UsersError):
    """ Raised when a username is invalid.
    """
    pass


class UserAlreadyExistsError(UsersError):
    """ Raised when a user already exists.
    """
    pass


class IncorrectPasswordError(UsersError):
    """ Raised if a password does not match the stored hash.
    """
    pass


# class used only by the module to store user data
class _UserEntry(object):

    def __init__(self, name, salt, hash, data, line=None):
        self.name = name
        self.salt = salt
        self.hash = hash
        self.data = data
        self._line = line

    def check_name(self, name):
        return self.name == name

    def set_name(self, name):
        if name is not None:
            self.name = name
        return self

    def set_data(self, data):
        self.data = data
        return self

    def update_data(self, *args):
        if len(args) > 0:
            data = self.data
            for arg in args[:-1]:
                if arg not in data:
                    data[arg] = {}
                data = data[arg]
            data.update(args[-1])
        return self


# yield user entries from the users file, and append a user if there is one
def _iter_users(append_user=None):
    try:
        with open(local_path(USERS_FILE), 'r+' if append_user is not None else 'r') as f:
            for line in f:
                name, salt, hash, data = line.split('\t', 3)
                salt = binascii.unhexlify(salt)
                hash = binascii.unhexlify(hash)
                yield _UserEntry(name, salt, hash, json.loads(data), line)
            if append_user is not None:
                # if we got here, the file pointer is at the end of the file
                _write_user(f, append_user)
    except IOError:
        raise UnitialisedError()


def _write_user(f, user):
    f.write(user.name)
    f.write('\t')
    f.write(binascii.hexlify(user.salt))
    f.write('\t')
    f.write(binascii.hexlify(user.hash))
    f.write('\t')
    f.write(json.dumps(user.data))
    f.write('\n')


def _new_user(username, password, data):
    salt = os.urandom(32)
    hash = hashlib.pbkdf2_hmac('sha256', password, salt, ROUNDS)
    return _UserEntry(username, salt, hash, data)


def create_user(username, password, data):
    """ Create a password hash from the given password and store the salt
        and resulting hash, along with username and any user data, in the
        users file.

        If the user already exists, raises UserAlreadyExistsError.
    """
    username = unicode(username)
    password = unicode(password)
    if not username.isalnum():
        raise InvalidUsername()
    user = _new_user(username, password, data)
    for user in _iter_users(user):
        if user.check_name(username):
            raise UserAlreadyExistsError()


def check_user(username, password):
    """ Check the given password guess against salt and hash. Returns user
        data if successful, or raises IncorrectPasswordError if unsuccessful.
    """
    username = unicode(username)
    password = unicode(password)
    if not username.isalnum():
        raise InvalidUsername()
    for user in _iter_users():
        if user.name == username:
            hash = hashlib.pbkdf2_hmac('sha256', password, user.salt, ROUNDS)
            if hash == user.hash:
                return user.data
    # fake attempt so hackers can't guess validity of usernames by time taken
    hashlib.pbkdf2_hmac('sha256', password, b'foo', ROUNDS)
    raise IncorrectPasswordError()


def iter_users():
    """ Yield user data, incorporating 'name' into the data.
    """
    for user in _iter_users():
        yield user.name, user.data


def get_user(username):
    """ Return data for the given username, or None if that username does
        not exist.
    """
    username = unicode(username)
    for user in _iter_users():
        if user.name == username:
            return user.data
    return None


def _rewrite_users(username, user_fn=None):
    username = unicode(username)
    try:
        with tempfile.NamedTemporaryFile(delete=False) as f:
            error = None
            ok = False
            for user in _iter_users():
                if user.name != username:
                    f.write(user._line)
                else:
                    ok = True
                    if user_fn is not None:
                        try:
                            user = user_fn(user)
                        except Exception as e:
                            error = e
                        _write_user(f, user)
            if error is not None:
                raise error
            return ok
    finally:
        os.rename(f.name, local_path(USERS_FILE))


def set_user(username, data):
    """ Set the data for the given username and returns whether the username
        exists.
    """
    username = unicode(username)
    return _rewrite_users(username, lambda user: user.set_data(data))


def update_user(username, *args):
    """ Update the data for the given username and returns whether the username
        exists. The last argument is the data stored, previous path arguments
        specify where to store it.
    """
    username = unicode(username)
    return _rewrite_users(username, lambda user: user.update_data(*args))


def delete_user(username):
    """ Delete the entry for the given user name. Returns whether that name
        existed.
    """
    username = unicode(username)
    return _rewrite_users(username)


def set_password(username, old_password, new_password):
    """ Set the password to be new_password for the given username if the
        old_password matches the currently stored password hash.

        Returns whether a user with the given name existed (if not, nothing
        is done).
    """
    username = unicode(username)
    old_password = unicode(old_password)
    new_password = unicode(new_password)
    check_user(username, old_password)
    return _rewrite_users(username, lambda user: _new_user(username, new_password, user.data))


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print "Usage: python {0} <username> <password>".format(sys.argv[0])
        sys.exit(1)

    # create users file if it does not exist, but just blank
    with open(local_path(USERS_FILE), 'a') as _:
        pass

    create_user(sys.argv[1], sys.argv[2], {'role': 'admin'})
    print "User {0} created".format(sys.argv[1])
