""" Module providing equivalent XPath for Python dictionary/array structures (JSON).
"""

def _weak_int(x):
  try:
    return int(x)
  except ValueError:
    return x


class PyPath:

  def __init__(self, path):
    self.path = [_weak_int(x) for x in path.split('/') if x != '']

  def __call__(self, x):
    return _Node(self.path, x)

  def __eq__(self, other):
    return self.path == other.path


class _Node:

  def __init__(self, path, x):
    if len(path) == 0:
      self.parent = { 'x': x }
      self.path = ['x']
      return
    self.parent = None
    for index in xrange(len(path)):
      key = path[index]
      self.parent = x
      if isinstance(key, int):
        if not isinstance(x, list):
          raise ValueError('%s => %s' % ('/'.join(path[:index]), type(x).__name__))
        x = x[key] if key < len(x) else None
      else:
        if not isinstance(x, dict):
          raise ValueError('%s => %s' % ('/'.join(path[:index]), type(x).__name__))
        x = x.get(key)
      if x is None:
        break
    self.path = path[index:]

  def get(self, default=None):
    if len(self.path) > 1:
      return default
    if isinstance(self.path[0], int):
      return self.parent[self.path[0]] if self.path[0] < len(self.parent) else default
    return self.parent.get(self.path[0], default)

  def set(self, value):
    if len(self.path) > 1:
      for index in xrange(len(self.path) - 1):
        if isinstance(self.path[index], int) and self.path[index] >= len(self.parent):
          self.parent.extend([None] * (1 + self.path[index] - len(self.parent)))
        self.parent[self.path[index]] = [] if isinstance(self.path[index + 1], int) else {}
        self.parent = self.parent[self.path[index]]
      self.path = self.path[-1:]
    if isinstance(self.path[0], int) and self.path[0] >= len(self.parent):
      self.parent.extend([None] * (1 + self.path[0] - len(self.parent)))
    self.parent[self.path[0]] = value

  def delete(self):
    if len(self.path) > 1:
      return
    del self.parent[self.path[0]]


if __name__ == '__main__':

  x = { 'foo': { 'bar': 'baz' }, 'array': [ 1, 2, 3 ] }

  assert PyPath('')(x).get() == x

  path = PyPath('/foo/bar')
  assert path(x).get() == 'baz'
  path(x).set('zog')
  assert path(x).get() == 'zog'
  path(x).delete()
  assert path(x).get() is None

  default = object()
  assert path(x).get(default) == default

  path = PyPath('/no/node')
  assert path(x).get() is None
  assert path(x).get(default) == default

  path = PyPath('/fee')
  path(x).set('fie')
  assert x['fee'] == 'fie'
  assert path(x).get() == 'fie'

  path = PyPath('/fee/fie')
  try:
    path(x).set('foe')
    assert False
  except ValueError:
    pass

  path = PyPath('/a/b')
  path(x).set(1)
  assert x['a']['b'] == 1
  assert path(x).get() == 1

  path = PyPath('/c')
  path(x).set({ 'd': True })
  assert x['c']['d'] == True

  path = PyPath('/array/1')
  assert path(x).get() == 2
  path(x).set(7)
  assert path(x).get() == 7
  path(x).delete()
  assert path(x).get() == 3
  assert len(path(x).parent) == 2

  path = PyPath('/aa/2/f')
  assert path(x).get('zip') == 'zip'
  path(x).set(7)
  assert x['aa'][2]['f'] == 7
  assert path(x).get() == 7
  assert x['aa'] == [None, None, { 'f': 7 }]

  path = PyPath('/aa/1/f')
  path(x).set(5)
  assert x['aa'][1]['f'] == 5

  path = PyPath('/o')
  n = path({})
  n.set([1, {'a': 'b'}, 3])
  assert n.get() == [1, {'a': 'b'}, 3]

  assert PyPath('/foo/bar') == PyPath('foo/bar')
