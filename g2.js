var path = require('path')
var repo = require('./repo')(path.resolve(__dirname, '.git'))
var repo2 = require('./repo')(path.resolve(__dirname, '../Anvol/.git'))
var Hashish = require('./src/hashish')
var Blob = require('./src/blob')
var Tree = require('./src/tree')
var Commit = require('./src/commit')

var hashish = Tree.of({
  file: Blob.of(new Buffer('hello world')),
  folder: Tree.of({
    file: Blob.of(new Buffer('hello world'))
  })
})
var t = new Tree(() => Promise.resolve('05a5a1023bf0bea3977c48072c3d88893afd21a5'))
var c = new Commit(() => Promise.resolve('938fabfe434e8ce0dfd80fbb1338989ba7d91439'))
// c.getHash(repo)
//   .then((value) => console.log(value))
//   .catch((err) => console.log(err.stack))

c.getHash(repo2)
  .then((value) => console.log(value))
  .catch((err) => console.log(err.stack))
