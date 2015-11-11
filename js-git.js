var repo = {}
repo.rootPath = __dirname + '/.git'
require('js-git/mixins/fs-db')(repo, require('./mac-fs.js'))
require('js-git/mixins/read-combiner')(repo)

var Tree = require('./src/tree')
var Blob = require('./src/blob')
var Commit = require('./src/commit')

var c = Commit.of({
  tree: Tree.of({
    a: Blob.of(new Buffer('a'))
  }),
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
c.valueOf(repo, console.log.bind(console))
c.getHash(repo, console.log.bind(console))
