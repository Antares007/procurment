'use strict'
var Tree = require('./src/tree')
var Blob = require('./src/blob')
var Commit = require('./src/commit')

var author = {
  name: 'Archil Bolkvadze',
  email: 'a.bolkvadze@gmail.com',
  date: new Date()
}

var c0 = Commit.of({
  tree: Tree.of({
    a: Blob.of(new Buffer('a'))
  }),
  author: author,
  committer: author,
  message: 'refine api 0\n'
})

var script = Blob.of(new Buffer(`seed = function (oldRoot, newRoot, oldTree) {
  return Tree.of({oldRoot, newRoot, oldTree})
}`))

c0
  .branch(script)
  // .grow(c1)
  // .grow(c2)
  .getHash(require('./repo')())
  .then(console.log.bind(console))
  .catch(console.log.bind(console))

