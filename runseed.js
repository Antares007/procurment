var path = require('path')

var repo = require('./repo')(path.resolve(__dirname, '.git'))

var Json = require('./src/json')
var Blob = require('./src/blob')
var Tree = require('./src/tree')

var srcTree = require('./src/treefromfs')(['src'], (x) => x.name.endsWith('.js'))

Tree.of({
  lib: srcTree,
  'index.js': fnBodyAsBlob(function () {
    var Tree = require('./lib/tree.js')
    var Blob = require('./lib/blob.js')
    module.exports = function () {
      return Tree.of({
        hello: Blob.of(new Buffer('world'))
      })
    }
  })
})
  // .bind(Tree, t => Tree.of(t))
  .getHash(repo)
  .then((value) => console.log(value))
  .catch((err) => console.log(err.stack))

function toTree (imports, fn) {
  var fnstr = fn.toString()
  var body = fnstr.substring(fnstr.indexOf('{') + 1, fnstr.lastIndexOf('}'))
  return fnstr.substring(fnstr.indexOf('(') + 1, fnstr.indexOf(')'))
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .reduce(function (tree, name, i) {
      var value = imports[i]
      console.log(name, i, value)
      return tree
    }, {
      'index.js': Blob.of(body)
    })
}

function fnBodyAsBlob (fn) {
  return Blob.of(new Buffer(fn.toString().slice(14).slice(0, -3)))
}
