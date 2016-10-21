from spectrum.fs_datastore import *

def test():
    try:
        assert not os.path.exists('.test')
        os.mkdir('.test') #FIXME use a proper py.test tempdir fixture

        Fsds = FsDataStore('.test/data', '.test/settings', '.test/samples')

        _s = Fsds.settings('foo')
        _s.read({'test': 'value'})
        assert _s.values == {'test': 'value'}
        _s.read()
        assert _s.values == {'test': 'value'}
        _s = Fsds.settings('foo')
        _s.read()
        assert _s.values == {'test': 'value'}
        _s.write({'a': 'b'})
        assert _s.values == {'a': 'b'}
        _s.read()
        assert _s.values == {'a': 'b'}

        _c = Fsds.config()
        _c.write(1060, {'config': 'values'})
        assert _c.values == {'config': 'values'}

        _c.write_spectrum(1066, [10, 20, -30])
        _c.write_spectrum(1080, [1, 2, 3])
        _c.write_spectrum(1200, [0, 0, 0])
        _c.write_spectrum(1300, [10, 10, 12])
        assert list(_c.iter_spectrum()) == [(1066, (10, 20, -30)),
                                            (1080, (1, 2, 3)),
                                            (1200, (0, 0, 0)),
                                            (1300, (10, 10, 12))]
        assert list(_c.iter_spectrum(1073, 1260)) == [(1080, (1, 2, 3)),
                                                      (1200, (0, 0, 0))]
        assert list(_c.iter_spectrum(1080, 1300)) == [(1080, (1, 2, 3)),
                                                      (1200, (0, 0, 0)),
                                                      (1300, (10, 10, 12))]
        assert list(_c.iter_spectrum(1066, 1200)) == [(1066, (10, 20, -30)),
                                                      (1080, (1, 2, 3)),
                                                      (1200, (0, 0, 0))]
        assert list(_c.iter_spectrum(500, 1500)) == [(1066, (10, 20, -30)),
                                                     (1080, (1, 2, 3)),
                                                     (1200, (0, 0, 0)),
                                                     (1300, (10, 10, 12))]
        assert list(_c.iter_spectrum(1070, 1074)) == []

        _c.write_audio(1066, 4)
        _c.write_audio(1080, 6)
        assert list(_c.iter_audio()) == [(1066, 4), (1080, 6)]
        assert list(_c.iter_audio(1050, 1070)) == [(1066, 4)]

        _c.write_rds_name(1066, 1, 'Radio 7')
        _c.write_rds_name(1080, 4, 'Bilbo')
        _c.write_rds_name(1090, 1, 'Frodo')
        _c.write_rds_name(1280, 6, 'Wikipedia')
        assert list(_c.iter_rds_name()) == [(1066, 1, 'Radio 7'),
                                            (1080, 4, 'Bilbo'),
                                            (1090, 1, 'Frodo'),
                                            (1280, 6, 'Wikipedia')]
        assert list(_c.iter_rds_name(1050, 1300)) == [(1066, 1, 'Radio 7'),
                                                      (1080, 4, 'Bilbo'),
                                                      (1090, 1, 'Frodo'),
                                                      (1280, 6, 'Wikipedia')]
        assert list(_c.iter_rds_name(1050, 1085)) == [(1066, 1, 'Radio 7'),
                                                      (1080, 4, 'Bilbo')]
        assert list(_c.iter_rds_name(1090, 1300)) == [(1090, 1, 'Frodo'),
                                                      (1280, 6, 'Wikipedia')]

        _c = Fsds.config()
        _c.write(999, {})
        _c.read()
        list(_c.iter_spectrum())

        assert [c.id for c in Fsds.iter_config()] == ['1060', '999']
        assert [c.id for c in Fsds.iter_config(['999'])] == ['999']
    finally:
        shutil.rmtree('.test')
