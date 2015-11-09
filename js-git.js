require('babel/register')({
  ignore: function(filename) {
    if (filename.indexOf('/Users/antares/projects/avtomati/src/') === 0) {
      return false
    } else {
      return true
    }
  }
})
// This provides symbolic names for the octal modes used by git trees.
var modes = require('js-git/lib/modes')

// Create a repo by creating a plain object.
var repo = {}

// This provides an in-memory storage backend that provides the following APIs:
// - saveAs(type, value) => hash
// - loadAs(type, hash) => hash
// - saveRaw(hash, binary) =>
// - loadRaw(hash) => binary
require('js-git/mixins/mem-db')(repo)

repo.rootPath = __dirname + '/.git'
require('js-git/mixins/fs-db')(repo, require('./mac-fs.js'))
// require('js-git/mixins/mem-cache')(repo)

// This adds a high-level API for creating multiple git objects by path.
// - createTree(entries) => hash
// require('js-git/mixins/create-tree')(repo)

// This provides extra methods for dealing with packfile streams.
// It depends on
// - unpack(packStream, opts) => hashes
// - pack(hashes, opts) => packStream
require('js-git/mixins/pack-ops')(repo)

// This adds in walker algorithms for quickly walking history or a tree.
// - logWalk(ref|hash) => stream<commit>
// - treeWalk(hash) => stream<object>
require('js-git/mixins/walkers')(repo)

// This combines parallel requests for the same resource for effeciency under load.
require('js-git/mixins/read-combiner')(repo)

// This makes the object interface less strict.  See it's docs for details
// require('js-git/mixins/formats')(repo)

var git = [
  'saveAs',
  'loadAs'
].reduce((s, x) => (s[x] = denodeify(repo[x].bind(repo)), s), { })

var Tree = require('./src/tree').Tree
var Blob = require('./src/blob').Blob
var Commit = require('./src/commit').Commit
var run = require('./src/genrun')

var b = Blob.of(new Buffer('hello world2'))
Commit.of({
  tree: Tree.of({
    Hello: Tree.of({
      There: Blob.of(new Buffer('hello world')).bind(Tree, function (buffer) {
        return Tree.of({
          hi: Blob.of(Buffer.concat([buffer, new Buffer(' gamarjoba')]))
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
.bind(Blob, function (commit) {
  return commit.tree.get(Blob, 'Hello/There/hi')
})
.valueOf(git)
.then(x => console.log(x))
.catch(err => console.log(err.stack))
return
// var main = async function () {

//   var txt = await git.someAction('hello world')
//   return
//   var blobHash = await git.saveAs('blob', 'Hello World\n')
//   var treeHash = await git.saveAs('tree', { 'greeting2.txt': { mode: modes.file, hash: blobHash } })
//   var commitHash = await git.saveAs('commit', {
//     author: {
//       name: 'Tim Caswell',
//       email: 'tim@creationix.com'
//     },
//     tree: treeHash,
//     message: 'Test commit\n'
//   })
//   console.log(commitHash)
//   return txt
// }
// main().then(x => console.log(x)).catch(err => console.log(err))

var run = require('gen-run')
run(function * () {
  // // Blocking logic goes here.  You can use yield
  var result = yield someAction('withArgs')
  console.log(result)
  // // The generator pauses at yield and resumes when the data is available.
  // // The rest of your process is not blocked, just this generator body.
  // // If there was an error, it will throw into this generator.

  // First we create a blob from a string.  The `formats` mixin allows us to
  // use a string directly instead of having to pass in a binary buffer.
  var blobHash = yield repo.saveAs('blob', 'Hello World\n')

  // Now we create a tree that is a folder containing the blob as `greeting.txt`
  var treeHash = yield repo.saveAs('tree', {
    'greeting.txt': { mode: modes.file, hash: blobHash }
  })

  // With that tree, we can create a commit.
  // Again the `formats` mixin allows us to omit details like committer, date,
  // and parents.  It assumes sane defaults for these.
  var commitHash = yield repo.saveAs('commit', {
    author: {
      name: 'Tim Caswell',
      email: 'tim@creationix.com'
    },
    tree: treeHash,
    message: 'Test commit\n'
  })
  console.log(commitHash)
  return
  // Create a log stream starting at the commit we just made.
  // You could also use symbolic refs like `refs/heads/master` for repos that
  // support them.
  var logStream = yield repo.logWalk(`refs/heads/master`)

  // Looping through the stream is easy by repeatedly calling waiting on `read`.
  var commit, object
  while ((commit = yield logStream.read(), commit !== undefined)) {
    console.log(commit)
    console.log('_____________')

    // We can also loop through all the files of each commit version.
    var treeStream = yield repo.treeWalk(commit.tree)
    while ((object = yield treeStream.read(), object !== undefined)) {
      console.log(object)
      console.log()
    }
    break
  }
}, function () {
  console.log(arguments)
})


// The function would be implemented to support both style like this.
function someAction (arg, callback) {
  if (!callback) return someAction.bind(this, arg)
  callback(null, arg)
  // We now have callback and arg
}

function denodeify (fn) {
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
