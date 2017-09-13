""" Unit tests for the fs_datastore module.
"""
from spectrum.fs_datastore import FsDataStore

def test(tmpdir):
    """ Test FsDatsStore functionality.
    """
    fsds = FsDataStore(str(tmpdir))

    s = fsds.settings('foo')
    s.read({'test': 'value'})
    assert s.values == {'test': 'value'}
    s.read()
    assert s.values == {'test': 'value'}
    s = fsds.settings('foo')
    s.read()
    assert s.values == {'test': 'value'}
    s.write({'a': 'b'})
    assert s.values == {'a': 'b'}
    s.read()
    assert s.values == {'a': 'b'}

    c = fsds.config()
    c.write(1060, {'config': 'values'})
    assert c.values == {'config': 'values'}

    c.write_spectrum(1066, [10, 20, -30])
    c.write_spectrum(1080, [1, 2, 3])
    c.write_spectrum(1200, [0, 0, 0])
    c.write_spectrum(1300, [10, 10, 12])
    assert list(c.iter_spectrum()) == [(1066, (10, 20, -30)),
                                       (1080, (1, 2, 3)),
                                       (1200, (0, 0, 0)),
                                       (1300, (10, 10, 12))]
    assert list(c.iter_spectrum(1073, 1260)) == [(1080, (1, 2, 3)),
                                                 (1200, (0, 0, 0))]
    assert list(c.iter_spectrum(1080, 1300)) == [(1200, (0, 0, 0)),
                                                 (1300, (10, 10, 12))]
    assert list(c.iter_spectrum(1066, 1200)) == [(1080, (1, 2, 3)),
                                                 (1200, (0, 0, 0))]
    assert list(c.iter_spectrum(500, 1500)) == [(1066, (10, 20, -30)),
                                                (1080, (1, 2, 3)),
                                                (1200, (0, 0, 0)),
                                                (1300, (10, 10, 12))]
    assert list(c.iter_spectrum(1070, 1074)) == []

    c.write_audio(1066, 4)
    c.write_audio(1080, 6)
    assert list(c.iter_audio()) == [(1066, 4), (1080, 6)]
    assert list(c.iter_audio(1050, 1070)) == [(1066, 4)]

    c.write_rds_name(1066, 1, 'Radio 7')
    c.write_rds_name(1080, 4, 'Bilbo')
    c.write_rds_name(1090, 1, 'Frodo')
    c.write_rds_name(1280, 6, 'Wikipedia')
    assert list(c.iter_rds_name()) == [(1066, 1, 'Radio 7'),
                                       (1080, 4, 'Bilbo'),
                                       (1090, 1, 'Frodo'),
                                       (1280, 6, 'Wikipedia')]
    assert list(c.iter_rds_name(1050, 1300)) == [(1066, 1, 'Radio 7'),
                                                 (1080, 4, 'Bilbo'),
                                                 (1090, 1, 'Frodo'),
                                                 (1280, 6, 'Wikipedia')]
    assert list(c.iter_rds_name(1050, 1085)) == [(1066, 1, 'Radio 7'),
                                                 (1080, 4, 'Bilbo')]
    assert list(c.iter_rds_name(1090, 1300)) == [(1280, 6, 'Wikipedia')]

    c = fsds.config()
    c.write(999, {})
    c.read()
    list(c.iter_spectrum())

    assert [c.id for c in fsds.iter_config()] == ['1060', '999']
    assert [c.id for c in fsds.iter_config(['999'])] == ['999']
