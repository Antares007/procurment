var Json = require('./src/json')
var Blob = require('./src/blob')

var fs = require('fs')
// var xlsx = require('../example/seeds/excel2fs')
// console.log(xlsx.xlsx.read(fs.readFileSync('../Anvol/modzraobebi/merani/gakidvebi/posisChascoreba01.06.2013.xlsx')))

var srcTree = require('./src/treefromfs')('src', (x) => x.name.endsWith('.js'))
// var xlsxTree = new Tree(() => Promise.resolve('1e031a57b1b6a8fd52b10664faeb16a2e66c9111'))
var xlsxTree = require('./src/treefromfs')('../example/seeds/excel2fs'.split('/'))

var seed = Seed.of({
  excel: xlsxTree,
  lib: srcTree,
  'main.js': fnBodyAsBlob(function () {
    var Tree = require('./lib/tree.js')
    var Json = require('./lib/json.js')
    var xlsx = require('./excel')

    module.exports = function (blob) {
      return Tree.of({
        'hello.json': blob.bind(Json, function (buffer) {
          return xlsx.import(buffer).map((s) => (s.rows = s.rows(), s))
        })
      })
    }
  }),
  'package.json': Json.of({
    main: 'main.js'
  })
})

var file = Blob.of(fs.readFileSync('../Anvol/modzraobebi/merani/gakidvebi/posisChascoreba01.06.2013.xlsx'))
seed = seed.bind(Seed, function (t) {
  return {
    seed: Seed.of(t),
    avi: srcTree,
    file,
    'index.js': fnBodyAsBlob(function () {
      var seed = require('./seed')
      // var Seed = require('./avi/seed.js')
      // var Json = require('./avi/json.js')
      module.exports = function () {
        return seed(this.file)
      }
    })
  }
}).call(Tree)
  .getHash(repo)
  .then((value) => console.log(value))
  .catch((err) => console.log(err.stack))



// function toTree (imports, fn) {
//   var fnstr = fn.toString()
//   var body = fnstr.substring(fnstr.indexOf('{') + 1, fnstr.lastIndexOf('}'))
//   return fnstr.substring(fnstr.indexOf('(') + 1, fnstr.indexOf(')'))
//     .split(',')
//     .map((x) => x.trim())
//     .filter(Boolean)
//     .reduce(function (tree, name, i) {
//       var value = imports[i]
//       console.log(name, i, value)
//       return tree
//     }, {
//       'index.js': Blob.of(body)
//     })
// }

function fnBodyAsBlob (fn) {
  return Blob.of(new Buffer(fn.toString().slice(14).slice(0, -3)))
}

