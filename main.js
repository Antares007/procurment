#!/usr/bin/env iojs
var argv = require('yargs').argv;
var stream = require('stream');
var request = require('request');
var cheerio = require('cheerio');

if(argv._.length !== 1) {
  console.log('add module name as argument');
  return;
}

var cookieJar = request.jar();

request.post({
  url : 'https://tenders.procurement.gov.ge/login.php',
  jar: cookieJar,
  form: {user:'qutateladze', pass:'natali2008', lang: 'ge'}
}, function(error, response, body) {
  if(error || response.statusCode !== 302) {
    throw error || response.statusCode;
  }

  var module = require(argv._[0]);
  module(session(cookieJar));
});

function session(cookieJar) {
  return {
    postForm: function(url, form, cb) {
      request.post({
        url : url,
        jar: cookieJar,
        form: form
      }, function(error, response, body) {
        if(error || response.statusCode !== 200) {
          return cb(error || response.statusCode);
        }
        cb(null, body);
      });
    },
    get: function(url, cb) {
      request.get({
        url : url,
        jar: cookieJar
      }, function(error, response, body) {
        if(error || response.statusCode !== 200) {
          return cb(error || response.statusCode);
        }
        cb(null, cheerio.load(body));
      });
    },
    stream: function(url, nextUrl, parser) {
      var get = this.get;
      var currentUrl = url;
      return new stream.Readable({
        objectMode: true,
        read: function(n) {
          var ds = this;
          get(currentUrl, function(err, $) {
            currentUrl = nextUrl(currentUrl, $);
            ds.push(parser($));
          });
        }
      });
    }
  };
}
