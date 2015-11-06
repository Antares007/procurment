import { GitObject } from './gitobject'
import { Blob } from './blob'
import { AStream } from './engine/astream'
import debuger from 'debug' // eslint-disable-line
let debug = debuger('tree')

const emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const nullSha = 'ec747fa47ddb81e9bf2d282011ed32aa4c59f932'

export class Tree extends GitObject {
  constructor (gitContext) {
    super(typeof gitContext === 'undefined' ? () => emptyTreeSha : gitContext)
    this.isTree = true
  }

  clear () {
    return new Tree()
  }

  rm (other) {
    return new Tree(
      async (git) => await git.mkDeepTree(
        await this.getSha(git),
        (await git.lsTree(await other.getSha(git), true))
          .map(e => ({ status: 'D', path: e.path }))
      )
    )
  }

  merge (other) {
    return new Tree(
      async (git) => await git.mkDeepTree(
        await this.getSha(git),
        (await git.lsTree(await other.getSha(git), true))
          .map(e => ({ status: 'A', path: e.path, newSha: e.sha, newMode: e.mode }))
      )
    )
  }

  merge3 (ours, theirs, fn) {
    var mkParam = (x) => x
      ? (x.mode.indexOf('100') === 0
         ? new Blob(x.sha)
         : new Tree(x.sha))
      : undefined

    return new Tree(
      async (git) => {
        var sha1 = await this.getSha(git)
        var sha2 = await ours.getSha(git)
        var sha3 = await theirs.getSha(git)
        debug('merged')
        debug(await git.lsTree(sha1))
        debug(await git.lsTree(sha2))
        debug(await git.lsTree(sha3))
        var rezSha = await git.merge3(
          sha1,
          sha2,
          sha3,
          async function (base, ours, theirs) {
            if ([base, ours, theirs].filter(x => !!x).length > 1) {
              debug(JSON.stringify({ base, ours, theirs }, null, '  '))
            }
            var merged = fn(mkParam(base), mkParam(ours), mkParam(theirs))
            if (merged === null) {
              return {
                status: 'D'
              }
            } else {
              return {
                mode: merged instanceof Blob ? '100644' : '040000',
                sha: await merged.getSha(git)
              }
            }
          }
        )
        debug(await git.lsTree(rezSha))
        return rezSha
      }
    )
  }

  diff (other) {
    return new Tree(async (git) => {
      var patchStream = git.diffTree(await this.getSha(git), await other.getSha(git))
        .transform(function (patch, next) {
          if (patch.status === 'M') {
            this.push({ newMode: patch.newMode, status: 'A', path: 'modified/new/' + patch.path, newSha: patch.newSha })
            this.push({ newMode: patch.oldMode, status: 'A', path: 'modified/old/' + patch.path, newSha: patch.oldSha })
          } else if (patch.status === 'A') {
            this.push({ newMode: patch.newMode, status: 'A', path: 'added/' + patch.path, newSha: patch.newSha })
          } else {
            this.push({ newMode: patch.oldMode, status: 'A', path: 'deleted/' + patch.path, newSha: patch.oldSha })
          }
          next()
        })
      return await git.mkDeepTree(emptyTreeSha, patchStream)
    })
  }

  reindex (fn) {
    var crypto = require('crypto')
    var hash = (str) => crypto.createHash('sha1').update(str).digest('hex')
    return new Tree(async (git) => {
      var ls = await git.lsTree(await this.getSha(git), true)
      var entries = ls.map(function (e) {
        var uniqKey = hash(e.path)
        var newPath = fn(e.path, uniqKey)
        if (newPath) {
          if (newPath.indexOf(uniqKey) === -1 && newPath.indexOf(e.path) === -1) {
            throw new Error('when reindexing new path should contain old path or hash(path)')
          }
          e.path = newPath
          return e
        }
      }).filter(function (e) {
        return e
      })
      return await git.mkDeepTree(emptyTreeSha, entries)
    })
  }

  reduce (fn, initTree) {
    return new Tree(async (git) => {
      var ls = await git.lsTree(await this.getSha(git), true)
      var newTree = ls.reduce((state, e) => fn(state, new Blob(e.sha), e.path), initTree)
      return await Tree.of(newTree).getSha(git)
    })
  }

  mapBlobs (fn) {
    return new Tree(async (git) => {
      var patchStream = git.diffTree(emptyTreeSha, await this.getSha(git))
        .transform(async function (patch) {
          var object = fn(new Blob(patch.newSha), patch.path)
          if (!object) return
          var sha = await object.getSha(git)
          if (sha === nullSha) return

          if (object instanceof Tree) {
            for (var entry of await git.lsTree(sha, true)) {
              this.push({
                newMode: entry.mode,
                status: 'A',
                path: patch.path + '/' + entry.path,
                newSha: entry.sha
              })
            }
          } else {
            patch.newSha = sha
            this.push(patch)
          }
        })
      return await git.mkDeepTree(emptyTreeSha, patchStream)
    })
  }

  filter (fn) {
    return new Tree(async (git) => {
      var patchStream = git.diffTree(emptyTreeSha, await this.getSha(git))
        .transform(async function (patch) {
          var object = fn(new Blob(patch.newSha), patch.path)
          var rez = object instanceof Blob
            ? JSON.parse((await git.cat(await object.getSha(git))).toString())
            : object
          if (rez) this.push(patch)
        })
      return await git.mkDeepTree(emptyTreeSha, patchStream)
    })
  }

  applyPatch (patchs) {
    return new Tree(async (git) => {
      return await git.mkDeepTree(await this.getSha(git), patchs)
    })
  }

  bind (fn) {
    return bind.call(this, Tree, fn)
  }

  toBlob (fn) {
    return bind.call(this, Blob, fn)
  }

  get (path, nullValue) {
    return get.call(this, Tree, path, nullValue)
  }

  getBlob (path, nullValue) {
    return get.call(this, Blob, path, nullValue)
  }

  static of (tree) {
    if (Object.keys.length === 0) {
      return new Tree(() => emptyTreeSha)
    }
    function traverseObj (obj, path, fn) {
      Object.keys(obj).forEach(function (key) {
        if (obj[key] && obj[key].constructor && obj[key].constructor.name === 'Object') {
          traverseObj(obj[key], path.concat(key), fn)
        } else {
          fn(path.concat(key), obj[key])
        }
      })
    }
    return new Tree(async (git) => {
      var entries = []
      traverseObj(tree, [], function (paths, value) {
        entries.push({
          path: paths.join('/'),
          gitObject: value instanceof GitObject ? value : Blob.of(value)
        })
      })
      if (entries.length === 0) return emptyTreeSha
      var patchStream = AStream.fromArray(entries)
        .transform(async function (x) {
          var sha = await x.gitObject.getSha(git)
          if (x.gitObject instanceof Tree) {
            for (var entry of await git.lsTree(sha, true)) {
              this.push({ newMode: '100644', status: 'A', path: x.path + '/' + entry.path, newSha: entry.sha })
            }
          } else {
            this.push({ newMode: '100644', status: 'A', path: x.path, newSha: sha })
          }
        })
      return await git.mkDeepTree(emptyTreeSha, patchStream)
    })
  }
}
Tree.emptySha = emptyTreeSha

function bind (Constructor, fn) {
  return new Constructor(async (git) => {
    var ls = await git.lsTree(await this.getSha(git))
    var entries = ls.map(
      e => Object.assign(
        e.type === 'blob' ? new Blob(e.sha) : new Tree(e.sha),
        e
      )
    ).reduce((s, e) => (s[e.name] = e, s), {})
    var rez = fn(entries)
    return await (rez instanceof Constructor ? rez : Constructor.of(rez)).getSha(git)
  })
}

function get (Constructor, path, nullValue) {
  return new Constructor(async (git) => {
    var sha = await this.getSha(git)
    try {
      var target = await git.revParse(sha + ':' + path)
      return target
    } catch (ex) {
      if (typeof nullValue !== 'undefined' && ex.code === 128) {
        return await (
          nullValue instanceof Constructor
            ? nullValue
            : Constructor.of(nullValue)
        ).getSha(git)
      }
      throw ex
    }
  })
}
