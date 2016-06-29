from config import *
from common import *
import hashlib
import binascii
import os
import os.path


class UsersError (Exception):
  """ Generic exception for this module.
  """
  pass


class UnitialisedError (UsersError):
  """ Raised when the username/password file does not exist.
  """
  pass


class InvalidUsername (UsersError):
  """ Raised when a username is invalid.
  """
  pass


class UserAlreadyExistsError (UsersError):
  """ Raised when a user already exists.
  """
  pass


class IncorrectPasswordError (UsersError):
  """ Raised if a password does not match the stored hash.
  """
  pass


# class used only by the module to store user data
class _UserEntry:

  def __init__(self, name, salt, hash, data):
    self.name = name
    self.salt = salt
    self.hash = hash
    self.data = data

  def check_name(self, name):
    return self.name == name


# yield user entries from the users file, and append a user obtained from the
# append_fn if there is one
def _iter_users(append_fn=None):
  try:
    with open(local_path(USERS_FILE), 'r+' if append_fn is not None else 'r') as f:
      for line in f:
        name, salt, hash, data = line.split('\t', 3)
        yield _UserEntry(name, binascii.unhexlify(salt), binascii.unhexlify(hash), json.loads(data))
      if append_fn is not None:
        user = append_fn()
        # if we got here, the file pointer is at the end of the file (having read every line)
        f.write(user.name)
        f.write('\t')
        f.write(binascii.hexlify(user.salt))
        f.write('\t')
        f.write(binascii.hexlify(user.hash))
        f.write('\t')
        f.write(json.dumps(user.data))
        f.write('\n')
  except IOError:
    raise UnitialisedError()


def create_user(username, password, data):
  """ Create a password hash from the given password and store the salt
      and resulting hash, along with username and any user data, in the
      users file.
      
      If the user already exists, raises UserAlreadyExistsError.
  """
  def _new_user():
    salt = os.urandom(32)
    hash = hashlib.pbkdf2_hmac('sha256', password, salt, ROUNDS)
    return _UserEntry(username, salt, hash, data)

  if not username.isalnum():
    raise InvalidUsername()
  for user in _iter_users(_new_user):
    if user.check_name(username):
      raise UserAlreadyExistsError()


def check_user(username, password):
  """ Check the given password guess against salt and hash. Returns user
      data if successful, or raises IncorrectPasswordError if unsuccessful.
  """
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


if __name__ == "__main__":
  import sys

  if len(sys.argv) != 3:
    print "Usage: python {0} <username> <password>".format(sys.argv[0])
    sys.exit(1)

  # create users file if it does not exist, but just blank
  with open(local_path(USERS_FILE), 'a') as f:
    pass

  create_user(sys.argv[1], sys.argv[2], { 'role': 'admin' })
  print "User {0} created".format(sys.argv[1])
