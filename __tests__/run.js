var fs = require('fs');
var path = require('path');
var cheerio = require('cheerio');
var assert = require('assert');

var ls = fs.readdirSync('.')
  .filter(function(file) { return fs.statSync(file).isDirectory(); })
  .forEach(function(d) {
    fs.readdirSync('./' + d)
      .filter(function(file) { return path.extname(file) === '.html'; })
      .forEach(function(file){
        var actualHtmlFile = './' + d + '/' + file;
        var expectedJsonFile = './' + d + '/' + path.basename(file, '.html') + '.js';

        var actual = require('../' + d)(cheerio.load(fs.readFileSync(actualHtmlFile, 'utf8')));
        var expected = require(expectedJsonFile);

        console.log('test -> ' + actualHtmlFile + ' = ' + expectedJsonFile);
        assert.deepEqual(actual, expected);
      });
  });
