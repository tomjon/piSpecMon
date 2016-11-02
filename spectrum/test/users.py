""" Unit tests for the users module.
"""
import pytest
import os
from spectrum.users import Users, IncorrectPasswordError


@pytest.fixture()
def users(tmpdir):
    """ Users object fixture.
    """
    users_file = os.path.join(str(tmpdir), 'users')
    users = Users(users_file, 10)
    return users


def test_no_users(users):
    """ Check behaviour when there are no users defined.
    """
    # check no users to begin with
    assert len(list(users.iter_users())) == 0

    # check you fail to log in
    with pytest.raises(IncorrectPasswordError):
        users.check_user("foo", "bar")

    # check operations for a particular user
    assert users.get_user("foo") is None
    assert users.set_user("foo", {}) == False
    assert users.update_user("foo", {}) == False
    assert users.delete_user("foo") == False

    # check you fail to set a password
    with pytest.raises(IncorrectPasswordError):
        users.set_password("foo", "old", "new")


def test_user(users):
    """ Check normal operations of an existing user.
    """
    DATA = {'foo': 'bar'}
    users.create_user('name', 'pass', DATA)

    assert users.get_user('name') == DATA
    assert list(users.iter_users()) == [('name', DATA)]
    assert users.check_user('name', 'pass') == DATA

    # check we can change the password
    users.set_password('name', 'pass', 'word')
    with pytest.raises(IncorrectPasswordError):
        users.check_user('name', 'pass')
    users.check_user('name', 'word')

    # check we can update/set the user data
    assert users.update_user('name', {'n': 1})
    assert users.get_user('name') == {'foo': 'bar', 'n': 1}
    assert users.update_user('name', {'n': 2})
    assert users.get_user('name') == {'foo': 'bar', 'n': 2}
    assert users.set_user('name', DATA)
    assert users.get_user('name') == DATA

    # finally, delete the user
    users.delete_user('name')
    assert len(list(users.iter_users())) == 0
