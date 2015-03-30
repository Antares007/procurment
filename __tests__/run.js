require("babel/register");
var argv = require('yargs').argv;
var fs = require('fs');
var path = require('path');
var assert = require('assert');

if(argv._.length === 1) {
  console.log(JSON.stringify(parse(argv._[0].split('/')[1], argv._[0]), null, '  '));
} else {
  runAllTests();
}

function runAllTests() {
  var ls = fs.readdirSync('.')
    .filter(function(file) { return fs.statSync(file).isDirectory(); })
    .forEach(function(d) {
      fs.readdirSync('./' + d)
      .filter(function(file) { return path.extname(file) === '.html'; })
      .forEach(function(file){
        var actualHtmlFile = './' + d + '/' + file;
        var expectedJsonFile = './' + d + '/' + path.basename(file, '.html') + '.js';

        var actual = parse(d, actualHtmlFile);
        var expected = require(expectedJsonFile);

        console.log('test -> ' + actualHtmlFile + ' = ' + expectedJsonFile);
        assert.deepEqual(actual, expected);
      });
    });
}

function parse(parserName, actualHtmlFile) {
  var cheerio = require('cheerio');
  return require('../' + parserName)(fs.readFileSync(actualHtmlFile, 'utf8'));
}
