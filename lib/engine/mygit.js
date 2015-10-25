var mkdirp = require('mkdirp')
var split = require('split')
var transform = require('./transform.js')
var assert = require('assert')
var {AStream} = require('./astream.js')
var debug = require('debug')('mygit')

module.exports = function gitStreamer (gitDir) {
  var gitCmdBase = gitDir ? `git --git-dir=${gitDir} ` : 'git '

  var git = function (cmd, mappers, options, cb) {
    if (typeof options === 'function') {
      cb = options
      options = {
        encoding: 'utf8', timeout: 0, maxBuffer: 1024 * 1024 * 1024, killSignal: 'SIGTERM'
      }
    }
    return exec(gitCmdBase + cmd, options, function (err, stdout) {
      if (err) {
        cb(err)
      } else {
        cb(null, mappers.reduce((m, fn) => fn(m), stdout))
      }
    })
  }

  var spawn = function (args, options) {
    var spawn = require('child_process').spawn
    var args2 = gitDir ? [`--git-dir=${gitDir}`].concat(args) : args
    debug('git ' + args2.join(' ') + ' ' + JSON.stringify(options))
    return spawn('git', args2, options)
  }

  var mappers = {
    parseDiffLine: function (x) {
      var [rest, path] = x.split('\t')
      var [oldMode, newMode, oldSha, newSha, status] = rest.split(' ')
      oldMode = oldMode.slice(1)
      if (newSha * 1 === 0) return { path, status, oldSha, oldMode }
      if (oldSha * 1 === 0) return { path, status, newSha, newMode }
      return { path, status, newSha, oldSha, newMode, oldMode }
    },
    parseDiffOutput: function (stdout) {
      return stdout.split('\n')
      .filter(x => x.length > 7)
      .map(this.parseDiffLine)
    },
    trimOutput: (stdout) => stdout.trim()
  }

  var api = {
    exec: git,
    spawn: spawn,
    mappers: mappers,
    revParse: function (rev, cb) {
      git('rev-parse ' + rev, [mappers.trimOutput], cb)
    },
    openIndex: function (path) {
      var options = { env: { GIT_INDEX_FILE: path } }
      return {
        readTree: function (sha, cb) {
          git('read-tree ' + sha, [], options, cb)
        },
        merge3: function (sha1, sha2, sha3, cb) {
          git(`read-tree -m -i ${sha1} ${sha2} ${sha3}`, [], options, cb)
        },
        ls: function (cb) {
          git(`ls-files -s -u`, [s => s.split('\n').slice(0, -1).map(x => {
            var [rest, path] = x.split('\t')
            var [mode, sha, stage] = rest.split(' ')
            return { mode, sha, stage, path }
          })], options, cb)
        },
        writeTree: function (cb) {
          git('write-tree', [mappers.trimOutput], options, cb)
        },
        createUpdateIndexInfoStream: function () {
          var child = spawn(['update-index', '--index-info'], options)
          child.once('exit', function () {
            child.stdin.emit('child.exit')
          })
          child.stdout.on('data', function (data) {
            console.log('uiis stdout', data)
          })
          child.stderr.on('data', function (data) {
            console.log('uiis stderr', data.toString())
          })
          child.stdin.on('error', (err) => console.log(err))
          return child.stdin
        }
      }
    },
    diffTree: function (tree1, tree2, args = ['--raw', '-r']) {
      return new AStream(() => spawn(['diff-tree'].concat(args, tree1, tree2)).stdout)
        .pipe(split())
        .transform(function (x, n) {
          if (x) this.push(mappers.parseDiffLine(x.toString()))
          n()
        })
    },
    lsTree: function (sha, rec, cb) {
      if (typeof rec === 'function') {
        cb = rec
        rec = false
      }
      if (rec) {
        git(
          'ls-tree -r ' + sha,
          [x => x.split('\n').filter(l => l).map((line) => {
            var [rest, path] = line.split('\t')
            var [mode, type, sha] = rest.split(' ')
            return { mode, type, sha, path }
          })],
          cb
        )
      } else {
        git(
          'ls-tree ' + sha,
          [x => x.split('\n').filter(l => l).map((line) => {
            var [rest, name] = line.split('\t')
            var [mode, type, sha] = rest.split(' ')
            return { mode, type, sha, name }
          })],
          cb
        )
      }
    },
    mktree: function (entries, cb) {
      var data = entries.map(e => `${e.mode} ${e.type} ${e.sha}\t${e.name}`).join('\n')
      git('mktree ', [mappers.trimOutput], cb).stdin.end(data, 'utf8')
    },
    commitTree: function (treeSha, parentShas, message, cb) {
      var parents = parentShas.length > 0 ? '-p ' + parentShas.join(' -p ') : ''
      git('commit-tree ' + parents + ' ' + treeSha, [mappers.trimOutput], cb)
        .stdin.end(message)
    },
    getCommit: function (sha, cb) {
      git(
        'cat-file -p ' + sha,
        [stdout => {
          var headerEnd = stdout.indexOf('\n\n')
          var header = stdout.slice(0, headerEnd)
          var message = stdout.slice(headerEnd + 2)
          return header.split('\n').reduce((cobj, line) => {
            if (line.indexOf('tree ') === 0) {
              cobj.tree = line.slice(5)
            } else if (line.indexOf('parent ') === 0) {
              cobj.parents = (cobj.parents || []).concat(line.slice(7))
            } else if (line.indexOf('author ') === 0) {
              cobj.author = line.slice(7)
            } else if (line.indexOf('committer ') === 0) {
              cobj.committer = line.slice(10)
            }
            return cobj
          }, {sha, message})
        }],
        { encoding: 'binary', timeout: 0, maxBuffer: 1000 * 1024, killSignal: 'SIGTERM' },
        cb
      )
    },
    getBlob: function (sha, cb) {
      git(
        'cat-file -p ' + sha,
        [mappers.trimOutput, x => new Buffer(x, 'binary')],
        { encoding: 'binary', timeout: 0, maxBuffer: 1000 * 1024, killSignal: 'SIGTERM' },
        cb
      )
    },
    hashObject: function (buffer, cb) {
      if (typeof buffer === 'undefined') throw new Error('git cant hash undefined')
      var zlib = require('zlib')
      var crypto = require('crypto')
      var fs = require('fs')

      var shasum = crypto.createHash('sha1')
      var header = new Buffer('blob ' + buffer.length + '\0')
      shasum.update(header)
      shasum.update(buffer)
      var sha = shasum.digest('hex')
      var fileDir = gitDir + '/objects/' + sha.slice(0, 2)
      var filePath = fileDir + '/' + sha.slice(2)
      zlib.deflate(Buffer.concat([header, buffer]), function (err, buffer) {
        if (err) return cb(err)
        mkdirp(fileDir, function () {
          fs.writeFile(filePath, buffer, { flag: 'wx' }, function (err) {
            if (err) {
              if (err.code === 'EEXIST') {
                cb(null, sha)
              } else {
                return cb(err)
              }
            }
            cb(null, sha)
          })
        })
      })
      // return
      // git(
      //   'hash-object --stdin -t blob -w',
      //   [mappers.trimOutput],
      //   cb
      // ).stdin.end(buffer);
    },
    catFileBatch: function () {
      var cbs = []
      var child = spawn(['cat-file', '--batch'])
      child.stderr.pipe(process.stderr)
      child.stdout.pipe((function () {
        var StringDecoder = require('string_decoder').StringDecoder
        var parser = makeHeadParser()

        return transform(function (chunk, next) {
          parser.call(this, chunk)
          next()
        })

        function makeHeadParser () {
          var decoder = new StringDecoder('utf8')
          var head = ''
          return function (chunk) {
            var indexOfLF = chunk.indexOf('\n')
            if (indexOfLF !== -1) {
              head += decoder.write(chunk.slice(0, indexOfLF))
              parser = makeContentParser.call(this, head)
              var rest = chunk.slice(indexOfLF + 1)
              parser.call(this, rest)
            } else {
              head += decoder.write(chunk)
            }
          }
        }

        function makeContentParser (headStr) {
          var segments = headStr.trim().split(' ')
          if (segments[1] === 'missing') {
            this.push({header: segments})
            return makeHeadParser()
          }
          var length = parseInt(segments[2], 10)
          var curLength = 0
          var contents = []

          return function (chunk) {
            if (chunk.length > length - curLength) {
              contents.push(chunk.slice(0, length - curLength))
              this.push({ header: segments, content: Buffer.concat(contents, length) })
              parser = makeHeadParser()
              parser.call(this, chunk.slice(length - curLength + 1))
            } else {
              contents.push(chunk)
              curLength += chunk.length
            }
          }
        }
      })())
      .on('data', function (data) {
        var cb = cbs.shift()
        assert(cb.sha === data.header[0])
        if (data.header[1] === 'missing') {
          cb.cb(new Error('missing'))
        } else {
          cb.cb(null, data.content)
        }
      })
      return {
        cat: function (sha, cb) {
          if (typeof sha !== 'string') throw new Error('git cant cat non string values ' + JSON.stringify(sha))
          debug('cat ' + sha)
          cbs.push({ sha, cb })
          child.stdin.write(sha + '\n')
        },
        end: function () {
          child.stdin.end()
        }
      }
    }
  }
  return denodeifyApi(api)
}

module.exports.getGitDir = function getGitDir (cb) {
  exec('git rev-parse --show-toplevel', (err, std) => cb(err, std ? std.trim() + '/.git' : std))
}

function exec (str, opt, cb) {
  if (typeof opt === 'function') {
    cb = opt
    opt = { encoding: 'utf8', timeout: 0, maxBuffer: 200 * 1024, killSignal: 'SIGTERM' }
  }
  debug(str)
  return require('child_process').exec(
    str,
    opt,
    function (error, stdout, stderr) {
      if (error) {
        return cb(error)
      } else if (stderr) {
        return cb(new Error(stderr))
      } else {
        cb(null, stdout)
      }
    }
  )
}

function denodeifyApi (mygit) {
  var denodeify = require('./denodeify.js')
  var git = [
    'exec',
    'revParse',
    'lsTree',
    'commitTree',
    'getCommit',
    'mktree',
    'hashObject',
    'getBlob'
  ].reduce((s, x) => (s[x] = denodeify(mygit[x]), s), {})

  git.catFileBatch = function () {
    var batch = mygit.catFileBatch()
    return {
      cat: denodeify(batch.cat),
      end: batch.end
    }
  }

  git.diffTree = mygit.diffTree

  git.openIndex = function (path) {
    var index = mygit.openIndex(path)
    return {
      readTree: denodeify(index.readTree),
      writeTree: denodeify(index.writeTree),
      merge3: denodeify(index.merge3),
      ls: denodeify(index.ls),
      createUpdateIndexInfoStream: index.createUpdateIndexInfoStream
    }
  }

  var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

  var indexInfoId = 0
  var toIndexInfoLine = function (p) {
    var { path, status, newSha, mode, sha, newMode } = p
    if (status) {
      return status !== 'D'
        ? `${newMode} ${newSha}\t${path}\n`
        : `0 0000000000000000000000000000000000000000\t${path}\n`
    } else {
      return `${mode} ${sha}\t${path}\n`
    }
  }

  git.merge3 = async function(sha1, sha2, sha3, fn) {
    var indexFileName = '/tmp/git-index-' + process.pid + '.' + (indexInfoId++) + '.tmp'
    var index = git.openIndex(indexFileName)
    await index.readTree(emptyTreeSha)
    await index.merge3(sha1, sha2, sha3)
    var entriestomerge = (await index.ls())
      .reduce((s, x) => (
        s[x.path] = (s[x.path] || {}),
        s[x.path][x.stage.toString()] = x,
        s
      ), {})
    var updates = await Promise.all(Object.keys(entriestomerge).map(async function (path) {
      var stages = entriestomerge[path]
      var rez = await fn(stages['1'], stages['2'], stages['3'])
      rez.path = path
      return rez
    }))
    updates = updates
      .map(x => ({status: 'D', path: x.path}))
      .concat(updates.filter(x => x.status !== 'D'))
      .map(toIndexInfoLine).join('')
    var indexInfo = index.createUpdateIndexInfoStream()
    await new Promise((resolve, reject) => {
      indexInfo
        .once('error', err => reject(err))
        .once('child.exit', () => resolve())
        .write(updates)
      indexInfo.end()
    })
    var sha = await index.writeTree()
    require('fs').unlink(indexFileName)
    return sha
  }

  git.mkDeepTree = async function (baseTree, patchStream) {
    var indexFileName = '/tmp/git-index-' + process.pid + '.' + (indexInfoId++) + '.tmp'
    var index = git.openIndex(indexFileName)
    await index.readTree(baseTree)
    var indexInfo = index.createUpdateIndexInfoStream()

    if (Array.isArray(patchStream)) {
      await new Promise((resolve, reject) => {
        indexInfo
          .once('error', err => reject(err))
          .once('child.exit', () => resolve())
          .write(patchStream.map(toIndexInfoLine).join(''))
        indexInfo.end()
      })
    } else {
      await patchStream
        .map(toIndexInfoLine)
        .writeTo(indexInfo)
    }
    var sha = await index.writeTree()
    require('fs').unlink(indexFileName)
    return sha
  }

  git.revListWalk = async function (fn, commitSha, skip = 0) {
    var rez = await git.exec(
      `rev-list --skip=${skip} --max-count=10 --pretty=oneline ${commitSha}`,
      [x => x.split('\n').slice(0, -1).map(x => ({sha: x.slice(0, 40), message: x.slice(41)}))]
    )
    if (rez.length === 0) return

    while (rez.length !== 0) {
      var cmt = rez.shift()
      var retValue = fn(cmt)
      if (typeof retValue !== 'undefined') {
        return retValue
      }
    }

    return await git.revListWalk(fn, commitSha, skip + 10)
  }
  return git
}
