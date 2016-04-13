var path = require('path')

var repo = require('./repo')(path.resolve(__dirname, '.git'))

var Json = require('./src/json')
var Blob = require('./src/blob')
var Tree = require('./src/tree')

// var xlsx = require('../example/seeds/excel2fs')
// var fs = require('fs')
// console.log(xlsx.xlsx.read(fs.readFileSync('../Anvol/modzraobebi/merani/gakidvebi/posisChascoreba01.06.2013.xlsx')))

var srcTree = require('./src/treefromfs')(['src'], (x) => x.name.endsWith('.js'))
var xlsxTree = require('./src/treefromfs')('../example/seeds/excel2fs'.split('/'))

var seed = Tree.of({
  excel: xlsxTree,
  lib: srcTree,
  'index.js': fnBodyAsBlob(function () {
    var Tree = require('./lib/tree.js')
    var Blob = require('./lib/blob.js')
    var xlsx = require('./excel')
    module.exports = function () {
      return Tree.of({
        hello: Blob.of(new Buffer('world'))
      })
    }
  }),
  'package.json': Json.of({
    main: 'index.js'
  })
})

Tree.of({
  seed,
  'index.js': fnBodyAsBlob(function () {
    var seed = require('./seed')
    module.exports = seed
  })
})
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
