#!/usr/bin/env node
'use strict'
require('babel/register')({ extensions: ['.es6', '.es', '.jsx', '.js'] })
var argv = require('yargs').argv

process.stdin.pipe(transform(function (chunk, encoding, next) {
  var ds = this
  chunk.toString().split('\n').filter(function (x) {
    return x.trim().length > 0
  }).forEach(function (rev) {
    ds.push(rev)
  })
  next()
})).pipe(transform(function (sha, encoding, next) {
  var ds = this
  findGitDir(function (error, gitDir) {
    if (error) {
      ds.emit('error', error)
    } else {
      require('../index.js')(
        sha,
        gitDir + '/.git',
        require(process.cwd() + '/' + argv._[0]),
        function (err, sha) {
          if (err) throw err
          ds.push(sha + '\n')
          next()
        }
      )
    }
  })
})).pipe(process.stdout)

function transform (fn) {
  var stream = require('stream')
  return new stream.Transform({ objectMode: true, transform: fn })
}
function findGitDir (cb) {
  require('child_process').exec('git rev-parse --show-toplevel', function (error, stdout, stderr) {
    if (error) {
      return cb(error)
    } else if (stderr) {
      return cb(new Error(stderr))
    } else {
      cb(null, stdout.trim())
    }
  })
}
