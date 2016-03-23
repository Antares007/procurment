var run = require('./run')
var avi = require('../src')
var Tree = avi.Tree
var Blob = avi.Blob

run([
  function aaa () {
    var t1 = Tree.of({
      at: Tree.of({
        ab: Blob.of(new Buffer('ab'))
      })
    })
    var t2 = Tree.of({
      ab: Blob.of(new Buffer('ab')),
      at: Tree.of({
        ab: Blob.of(new Buffer('ab')),
        ac: Blob.of(new Buffer('ab'))
      })
    })
    var actual = t1.diff({ added: (n, path) => n }, t2)
    var expected = t2
    return { actual, expected }
  }
])
