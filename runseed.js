var resolve = require('path').resolve
var repo = require('./repo')
var anvolRepo = repo(resolve(__dirname, '../Anvol/.git'))
var aviRepo = repo(resolve(__dirname, '.git'))
var Tree = require('./src/tree')
// var Seed = require('./src/seed')
var Blob = require('./src/blob')
var Commit = require('./src/commit')
var Hashish = require('./src/hashish')

var anvolTreeCommit = Hashish.get(Commit, anvolRepo, 'c190338126fcae417668c755448975d1f7132eec')

// var anvolTree = Hashish.get(Tree, anvolRepo, 'd9bd6a75ce3fc0028d32ba4b9c3462d1e6ee7271')
// var anvolTree = anvolTreeCommit.bind(Tree, (c) => c.tree)

var anvolSoft = importDir('../AnvolSoft')
  .bind(Tree, function (t) {
    return {
      anvolTreeCommit,
      seed: Tree.of(t),
      'index.js': fnBodyAsBlob(function () {
        var seed = require('./seed')
        module.exports = function () {
          return seed(module.tree)
        }
      })
    }
  })

anvolSoft
  .valueOf(aviRepo)
  .then((value) => console.log(value))
  .catch((err) => console.log(err.stack))

function importDir (dir) {
  var readdir = require('./src/treefromfs')
  return readdir(dir, (e) => e.name !== '.git' || !e.stats.isDirectory())
}

function fnBodyAsBlob (fn) {
  return Blob.of(new Buffer(fn.toString().slice(14).slice(0, -3)))
}
