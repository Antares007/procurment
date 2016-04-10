var path = require('path')
var repo = require('./repo')(path.resolve(__dirname, '.git'))
var repo2 = require('./repo')(path.resolve(__dirname, '../Anvol/.git'))
var Hashish = require('./src/hashish')
var Blob = require('./src/blob')
var Tree = require('./src/tree')
var GitObject = require('./src/gitobject')
var Commit = require('./src/commit')

var hashish = Tree.of({
  file: Blob.of(new Buffer('hello world')),
  folder: Tree.of({
    // file: Blob.of(new Buffer('hello world'))
  })
})
var t = new Tree(() => Promise.resolve('2446be78f91fc13caa534c405936a8e68b3e4b00'))
var c = new Commit(() => Promise.resolve('938fabfe434e8ce0dfd80fbb1338989ba7d91439'))

Blob.of(new Buffer('aa\n'))
  .bind(Blob, (b) => Blob.of(b))
  .getHash(repo)
  .then((value) => console.log(value))
  .catch((err) => console.log(err.stack))
