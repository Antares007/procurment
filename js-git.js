require('babel/register')({
  ignore: function (filename) {
    if (filename.indexOf('/Users/antares/projects/avtomati/src/') === 0) {
      return false
    } else {
      return true
    }
  }
})

var repo = {}
repo.rootPath = __dirname + '/.git'
require('js-git/mixins/fs-db')(repo, require('./mac-fs.js'))
require('js-git/mixins/read-combiner')(repo)

var git = [
  'saveAs',
  'loadAs'
].reduce(
  (s, x) => (s[x] = toPromise(repo[x].bind(repo)), s),
  {}
)

var Tree = require('./src/tree').Tree
var Blob = require('./src/blob').Blob
var Commit = require('./src/commit').Commit

Blob.of(new Buffer('hello')).getHash(repo, function (err, hash) {
  console.log(err, hash)
})
return
Commit.of({
  tree: Tree.of({
    a: Blob.of(new Buffer('a')),
    b: Blob.of(new Buffer('b')),
    c: Blob.of(new Buffer('c')),
    Hello: Tree.of({
      There: Blob.of(new Buffer('hello world')).bind(Tree, function (buffer) {
        return Tree.of({
          hi: Blob.of(Buffer.concat([ buffer, new Buffer(' gamarjoba') ]))
        })
      })
    })
  }),
  parents: [],
  author: {
    name: 'Archil Bolkvadze',
    email: 'a.bolkvadze@gmail.com',
    date: { seconds: 1446842087, offset: -240 }
  },
  committer: {
    name: 'Archil Bolkvadze',
    email: 'a.bolkvadze@gmail.com',
    date: { seconds: 1446842087, offset: -240 }
  },
  message: 'refine api\n'
})
.bind(Tree, function (commit) {
  return commit.tree.bind(Tree, function (tree) {
    tree.zmuki = tree.a.merge([tree.b, tree.c], function (buffers) {
      return Buffer.concat(buffers)
    })
    tree.mashamasha = Blob.of(new Buffer('mahssaaaa'))
    return Tree.of(tree)
  })
})
.getSha(git)
.then(x => console.log(x))
.catch(err => console.log(err.stack))

function toPromise (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    return new Promise(function (resolve, reject) {
      fn.apply(
        {},
        args.concat(function callback () {
          var args = Array.prototype.slice.call(arguments)
          var err = args[0]
          var values = args.slice(1)
          if (err) {
            reject(err)
          } else {
            resolve.apply({}, values)
          }
        })
      )
    })
  }
}
