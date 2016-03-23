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
  var engine = require('../src/engine')
  engine.start()
    .then((git) => {
      var Commit = require('../src/commit').Commit
      var module = require(process.cwd() + '/' + argv._[0])
      var rezCommit = module(new Commit(sha))
      return rezCommit.getSha(git).then(function (sha) {
        git.stop()
        ds.push(sha)
      })
    })
    .catch((err) => process.nextTick(function () {
      ds.emit('error', err)
    }))
})).pipe(process.stdout)

function transform (fn) {
  var stream = require('stream')
  return new stream.Transform({ objectMode: true, transform: fn })
}
