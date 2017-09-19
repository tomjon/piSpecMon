""" Unit tests for the fs_datastore module.
"""
from spectrum.binary_datastore import BinaryDataStore

def test(tmpdir):
    """ Test BinaryDataStore functionality.
    """
    data = BinaryDataStore(str(tmpdir))

    s = data.settings('foo')
    s.read({'test': 'value'})
    assert s.values == {'test': 'value'}
    s.read()
    assert s.values == {'test': 'value'}
    s = data.settings('foo')
    s.read()
    assert s.values == {'test': 'value'}
    s.write({'a': 'b'})
    assert s.values == {'a': 'b'}
    s.read()
    assert s.values == {'a': 'b'}

    c = data.config()
    c.write(1060, {'config': 'values'})
    assert c.values == {'config': 'values'}

    c.write_spectrum('catlib', 1066, [10, 20, -30])
    c.write_spectrum('catlib', 1080, [1, 2, 3])
    c.write_spectrum('catlib', 1200, [0, 0, 0])
    c.write_spectrum('catlib', 1300, [10, 10, 12])
    assert list(c.iter_spectrum('catlib')) == [(1066, (10, 20, -30)),
                                       (1080, (1, 2, 3)),
                                       (1200, (0, 0, 0)),
                                       (1300, (10, 10, 12))]
    assert list(c.iter_spectrum('catlib', 1073, 1260)) == [(1080, (1, 2, 3)),
                                                 (1200, (0, 0, 0))]
    assert list(c.iter_spectrum('catlib', 1080, 1300)) == [(1200, (0, 0, 0)),
                                                 (1300, (10, 10, 12))]
    assert list(c.iter_spectrum('catlib', 1066, 1200)) == [(1080, (1, 2, 3)),
                                                 (1200, (0, 0, 0))]
    assert list(c.iter_spectrum('catlib', 500, 1500)) == [(1066, (10, 20, -30)),
                                                (1080, (1, 2, 3)),
                                                (1200, (0, 0, 0)),
                                                (1300, (10, 10, 12))]
    assert list(c.iter_spectrum('catlib', 1070, 1074)) == []

    c.write_audio('catlib', 1066, 4)
    c.write_audio('catlib', 1080, 6)
    assert list(c.iter_audio('catlib')) == [(1066, 4), (1080, 6)]
    assert list(c.iter_audio('catlib', 1050, 1070)) == [(1066, 4)]

    c.write_rds_name('catlib', 1066, 1, 'Radio 7')
    c.write_rds_name('catlib', 1080, 4, 'Bilbo')
    c.write_rds_name('catlib', 1090, 1, 'Frodo')
    c.write_rds_name('catlib', 1280, 6, 'Wikipedia')
    assert list(c.iter_rds_name('catlib')) == [(1066, 1, 'Radio 7'),
                                       (1080, 4, 'Bilbo'),
                                       (1090, 1, 'Frodo'),
                                       (1280, 6, 'Wikipedia')]
    assert list(c.iter_rds_name('catlib', 1050, 1300)) == [(1066, 1, 'Radio 7'),
                                                 (1080, 4, 'Bilbo'),
                                                 (1090, 1, 'Frodo'),
                                                 (1280, 6, 'Wikipedia')]
    assert list(c.iter_rds_name('catlib', 1050, 1085)) == [(1066, 1, 'Radio 7'),
                                                 (1080, 4, 'Bilbo')]
    assert list(c.iter_rds_name('catlib', 1090, 1300)) == [(1280, 6, 'Wikipedia')]

    c = data.config()
    c.write(999, {})
    c.read()
    list(c.iter_spectrum('catlib'))

    assert [c.id for c in data.iter_config()] == ['1060', '999']
    assert [c.id for c in data.iter_config(['999'])] == ['999']
