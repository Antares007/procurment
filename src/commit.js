'use strict'
const GitObject = require('./gitobject')
var Tree = require('./tree')

class Commit extends GitObject {
  valueOf (api) {
    return super.valueOf(api).then(function (go) {
      if (go.type !== 'commit') throw new Error('not a commit')
      var value = decodeCommit(go.body)
      var tree = new Tree((api_) => api.valueOf(value.tree).then(api_.hash))
      tree.hash = value.tree
      var commit = Object.assign({}, value, {
        tree,
        parents: value.parents.map(function (hash) {
          var c = new Commit((api_) => api.valueOf(hash).then(api_.hash))
          c.hash = hash
          return c
        })
      })
      if (commit.parents.length === 0) {
        delete commit.parents
      }
      return commit
    })
  }

  static of (def) {
    var objs = (def.parents || []).concat(def.tree)
    return new Commit(
      (api) => Promise.all(objs.map((o) => o.getHash(api))).then((hashes) => {
        var treeHash = hashes.pop()
        var parentHases = hashes
        var commit = Object.assign({}, def, { tree: treeHash, parents: parentHases })
        return GitObject.of({
          type: 'commit',
          body: encodeCommit(commit)
        }).getHash(api)
      })
    )
  }
}
module.exports = Commit

function encodeCommit (body) {
  var str = 'tree ' + body.tree
  for (var i = 0, l = body.parents.length; i < l; ++i) {
    str += '\nparent ' + body.parents[i]
  }
  str += '\nauthor ' + formatPerson(body.author) +
         '\ncommitter ' + formatPerson(body.committer) +
         '\n\n' + body.message
  return new Buffer(str, 'utf8')
}

function decodeCommit (body) {
  var i = 0
  var start
  var key
  var parents = []
  var commit = { tree: '', parents: parents, author: '', committer: '', message: '' }
  while (body[i] !== 0x0a) {
    start = i
    i = body.indexOf(0x20, start)
    if (i < 0) throw new SyntaxError('Missing space')
    key = body.slice(start, i++).toString('binary')
    start = i
    i = body.indexOf(0x0a, start)
    if (i < 0) throw new SyntaxError('Missing linefeed')
    var value = body.slice(start, i++).toString('utf8')
    if (key === 'parent') {
      parents.push(value)
    } else {
      if (key === 'author' || key === 'committer') {
        value = decodePerson(value)
      }
      commit[key] = value
    }
  }
  i++
  commit.message = body.slice(i, body.length).toString('utf8')
  return commit
}

function formatPerson (person) {
  return safe(person.name) + ' <' + safe(person.email) + '> ' + formatDate(person.date)
}

function formatDate (date) {
  var seconds, offset
  if (date.seconds) {
    seconds = date.seconds
    offset = date.offset
  } else { // Also accept Date instances
    seconds = Math.floor(date.getTime() / 1000)
    offset = date.getTimezoneOffset()
  }
  var neg = '+'
  if (offset <= 0) offset = -offset
  else neg = '-'
  offset = neg + two(Math.floor(offset / 60)) + two(offset % 60)
  return seconds + ' ' + offset
}

function safe (string) {
  return string.replace(/(?:^[\.,:;<>"']+|[\0\n<>]+|[\.,:;<>"']+$)/gm, '')
}

function two (num) {
  return (num < 10 ? '0' : '') + num
}

function decodePerson (string) {
  var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/)
  if (!match) throw new Error('Improperly formatted person string')
  return {
    name: match[1],
    email: match[2],
    date: {
      seconds: parseInt(match[3], 10),
      offset: parseInt(match[4], 10) / 100 * -60
    }
  }
}
