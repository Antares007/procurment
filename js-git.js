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
require('js-git/mixins/mem-db')(repo)
require('js-git/mixins/fs-db')(repo, require('./mac-fs.js'))
require('js-git/mixins/pack-ops')(repo)
require('js-git/mixins/walkers')(repo)
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

Commit.of({
  tree: Tree.of({
    Hello: Tree.of({
      There: Blob.of(new Buffer('hello world')).bind(Tree, function (buffer) {
        return Tree.of({
          hi: Blob.of(Buffer.concat([ buffer, new Buffer(' gamarjoba') ]))
        })
      })
    })
  }),
  parents: [
    Commit.of({
      tree: Tree.of({
        file: Blob.of(new Buffer('content'))
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
      message: 'initial commit\n'
    })
  ],
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
.getSha(git)
.then(x => console.log(x))
.catch(err => console.log(err.stack))

function toPromise (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    return new Promise(function (resolve, reject) {
      fn.apply(
        {},
        args.concat(function () {
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
