var repo = require('./repo')()
var Tree = require('./src/tree')
var Blob = require('./src/blob')
var mktree = require('./src/treefromfs')

var value = mktree(require('path').resolve(__dirname, '../Anvol').split('/'), (e) => e.name !== '.git' && e.name !== 'node_modules')

// repo.get(Tree, 'd9bd6a75ce3fc0028d32ba4b9c3462d1e6ee7271')

var tree = value.bind(Blob, function rec (path, t) {
  console.log(path.join('/'))
  return Object.keys(t).map(function (name) {
    return t[name] instanceof Tree
      ? t[name].bind(Blob, rec.bind({}, path.concat(name)))
      : Blob.of(new Buffer(path.concat(name).join('/') + '\n'))
  }).reduce((b1, b2) => b1.bind(Blob, (buff1) => b2.bind(Blob, (buff2) => Blob.of(Buffer.concat([buff1, buff2])))))
}.bind({}, []))

repo.getHash(tree)
  .then((value) => console.log(value.toString()))
  .catch((err) => console.log(err.stack))
