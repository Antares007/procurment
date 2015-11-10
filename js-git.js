var repo = {}
repo.rootPath = __dirname + '/.git'
require('js-git/mixins/fs-db')(repo, require('./mac-fs.js'))
require('js-git/mixins/read-combiner')(repo)

var avi = require('./src/index')
var Tree = avi.Tree
var Blob = avi.Blob
var Commit = avi.Commit

Commit.of({
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
// .bind(Tree, function (commit) {
//   return commit.tree.bind(Tree, function (tree) {
//     // tree.zmuki = tree.a.merge([tree.b, tree.c], function (buffers) {
//     //   return Buffer.concat(buffers)
//     // })
//     tree.mashamasha = Blob.of(new Buffer('mahssaaaa'))
//     return Tree.of(tree)
//   })
// })
.valueOf(repo, function (err, hash) {
  console.log(err, hash)
})
