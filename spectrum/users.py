""" Module provides functions for manipulating the users.passwords file (which is very much
    like /etc/passwords).
"""
import hashlib
import binascii
import os
import tempfile
import json


class UsersError(Exception):
    """ Generic exception for this module.
    """
    pass


class UninitialisedError(UsersError):
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
    def __init__(self, name, salt, hash_value, data, line=None):
        self.name = name
        self.salt = salt
        self.hash = hash_value
        self.data = data
        self.line = line

    def check_name(self, name):
        """ Return whether the user name is as specified.
        """
        return self.name == name

    def set_name(self, name):
        """ Set the user name.
        """
        if name is not None:
            self.name = name
        return self

    def set_data(self, data):
        """ Set the user data.
        """
        self.data = data
        return self

    def update_data(self, *args):
        """ Update the user data.
        """
        if len(args) > 0:
            data = self.data
            for arg in args[:-1]:
                if arg not in data:
                    data[arg] = {}
                data = data[arg]
            data.update(args[-1])
        return self


class Users(object):
    """ API for user name and password manipulation.
    """
    def __init__(self, users_file, rounds):
        self.users_file = users_file
        self.rounds = rounds

        # create users file if it does not exist, but just blank
        with open(users_file, 'a') as _:
            pass

    # yield user entries from the users file, and append a user if there is one
    def _iter_users(self, append_user=None):
        try:
            with open(self.users_file, 'r+' if append_user is not None else 'r') as f:
                for line in f:
                    name, salt, hash_value, data = line.split('\t', 3)
                    salt = binascii.unhexlify(salt)
                    hash_value = binascii.unhexlify(hash_value)
                    yield _UserEntry(name, salt, hash_value, json.loads(data), line)
                if append_user is not None:
                    # if we got here, the file pointer is at the end of the file
                    self._write_user(f, append_user)
        except IOError:
            raise UninitialisedError()

    def _write_user(self, f, user): # pylint: disable=no-self-use
        f.write(user.name)
        f.write('\t')
        f.write(binascii.hexlify(user.salt))
        f.write('\t')
        f.write(binascii.hexlify(user.hash))
        f.write('\t')
        f.write(json.dumps(user.data))
        f.write('\n')

    def _new_user(self, username, password, data):
        salt = os.urandom(32)
        hash_value = hashlib.pbkdf2_hmac('sha256', password, salt, self.rounds)
        return _UserEntry(username, salt, hash_value, data)

    def create_user(self, username, password, data):
        """ Create a password hash from the given password and store the salt
            and resulting hash, along with username and any user data, in the
            users file.

            If the user already exists, raises UserAlreadyExistsError.
        """
        username = unicode(username)
        password = unicode(password)
        if not username.isalnum():
            raise InvalidUsername()
        user = self._new_user(username, password, data)
        for user in self._iter_users(user):
            if user.check_name(username):
                raise UserAlreadyExistsError()

    def check_user(self, username, password):
        """ Check the given password guess against salt and hash. Returns user
            data if successful, or raises IncorrectPasswordError if unsuccessful.
        """
        username = unicode(username)
        password = unicode(password)
        if not username.isalnum():
            raise InvalidUsername()
        for user in self._iter_users():
            if user.name == username:
                hash_value = hashlib.pbkdf2_hmac('sha256', password, user.salt, self.rounds)
                if hash_value == user.hash:
                    return user.data
        # fake attempt so hackers can't guess validity of usernames by time taken
        hashlib.pbkdf2_hmac('sha256', password, b'foo', self.rounds)
        raise IncorrectPasswordError()

    def iter_users(self):
        """ Yield user names and data.
        """
        for user in self._iter_users():
            yield user.name, user.data

    def get_user(self, username):
        """ Return data for the given username, or None if that username does
            not exist.
        """
        username = unicode(username)
        for user in self._iter_users():
            if user.name == username:
                return user.data
        return None

    def _rewrite_users(self, username, user_fn=None):
        username = unicode(username)
        try:
            with tempfile.NamedTemporaryFile(delete=False) as f:
                error = None
                ok = False
                for user in self._iter_users():
                    if user.name != username:
                        f.write(user.line)
                    else:
                        ok = True
                        if user_fn is not None:
                            try:
                                user = user_fn(user)
                            except UsersError as e:
                                error = e
                            self._write_user(f, user)
                if error is not None:
                    raise error # pylint: disable=raising-bad-type
                return ok
        finally:
            os.rename(f.name, self.users_file)

    def set_user(self, username, data):
        """ Set the data for the given username and returns whether the username
            exists.
        """
        username = unicode(username)
        return self._rewrite_users(username, lambda user: user.set_data(data))

    def update_user(self, username, *args):
        """ Update the data for the given username and returns whether the username
            exists. The last argument is the data stored, previous path arguments
            specify where to store it.
        """
        username = unicode(username)
        return self._rewrite_users(username, lambda user: user.update_data(*args))

    def delete_user(self, username):
        """ Delete the entry for the given user name. Returns whether that name
            existed.
        """
        username = unicode(username)
        return self._rewrite_users(username)

    def set_password(self, username, old_password, new_password):
        """ Set the password to be new_password for the given username if the
            old_password matches the currently stored password hash.

            Raises IncorrectPasswordError if the user did not exist or the old
            password is incorrect.
        """
        username = unicode(username)
        old_password = unicode(old_password)
        new_password = unicode(new_password)
        self.check_user(username, old_password)
        fn = lambda user: self._new_user(username, new_password, user.data)
        return self._rewrite_users(username, fn)
