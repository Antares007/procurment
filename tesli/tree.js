var { GitObject } = require('./gitobject')
var { Blob } = require('./blob')
var debug = require('debug')('tree')
var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export class Tree extends GitObject {
  constructor (gitContext) {
    super(typeof gitContext === 'undefined' ? () => emptyTreeSha : gitContext)
  }

  get (path, nullValue) {
    return new Tree(async (git) => {
      var sha = await this.getSha(git)
      try {
        var target = await git.revParse(sha + ':' + path)
        return target
      } catch (ex) {
        if (ex.message.indexOf('does not exist in') >= 0 ||
           ex.message.indexOf('exists on disk, but not in') >= 0) {
          return await nullValue.getSha(git)
        }
        throw ex
      }
    })
  }

  applyPatch (patchs) {
    return new Tree(async (git) => {
      return await git.mkDeepTree(await this.getSha(git), patchs)
    })
  }

  cd (fn) {
    return new Tree(async (git) => {
      var tree = (await git.lsTree(await this.getSha(git))).reduce(function (tree, entry) {
        tree[entry.name] = entry.type === 'tree' ? new Tree(entry.sha) : new Blob(entry.sha)
        return tree
      }, {})

      fn.call(tree, tree)

      return await Tree.of(tree).getSha(git)
    })
  }

  static of (tree) {
    if (Object.keys.length === 0) {
      return new Tree(() => emptyTreeSha)
    }
    return new Tree(async (git) => {
      Object.keys(tree).forEach(function (key) {
        if (tree[key] instanceof Tree || tree[key] instanceof Blob) {
          return
        }
        if (Object.getPrototypeOf(tree[key]) === Object.prototype) {
          tree[key] = Tree.of(tree[key])
        } else {
          tree[key] = Blob.of(tree[key])
        }
      })

      return await git.mktree(
        await Promise.all(
          Object.keys(tree).map(async function(name) {
            var e = tree[name]
            var type = e instanceof Tree ? 'tree' : 'blob'
            var mode = e instanceof Tree ? '040000' : '100644'
            var sha = await e.getSha(git)
            return { mode, type, sha, name }
          })
        )
      )
    })
  }

  reduce (depth, fn) {
    if (typeof depth === 'function') {
      fn = depth
      depth = 0
    }
    return new Tree(async (git) => {
      var sha = await this.getSha(git)
      debug('reducing: ' + sha)
      var entries = await git.lsTree(sha)

      var newEntries = await Promise.all(
        entries.map(async function(e) {
          var {mode, type, sha, name} = e
          if (type !== 'tree') { return e }
          if (depth === 0) {
            sha = await (new Tree(sha).toBlob(fn).getSha(git))
            type = 'blob'
            mode = '100644'
          } else {
            sha = await (new Tree(sha).reduce(depth - 1, fn).getSha(git))
          }
          return {mode, type, sha, name}
        })
      )

      debug('reduced: ' + sha)
      return await git.mktree(newEntries)
    })
  }

  toBlob (fn) {
    return new Blob(async (git) => {
      var sha = await this.getSha(git)
      debug('blobing: ' + sha)
      var entries = await git.lsTree(sha)

      var shas = await Promise.all(
        entries.map(x => x.type === 'tree' ? new Tree(x.sha).toBlob(fn).getSha(git) : x.sha)
      )

      var buffers = await Promise.all(shas.map(x => git.cat(x)))
      var blobSha = await git.hashObject(fn(buffers))
      debug('blobed: ' + sha + ' -> ' + blobSha)
      return blobSha
    })
  }
}

Tree.emptySha = emptyTreeSha
