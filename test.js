var fs = require('fs');
var cheerio = require('cheerio');
var parseTender = require('./parseTenderListPage.js');

var html = fs.readFileSync('./tendersList.html', 'utf8');

var $ = cheerio.load(html);

var list = parseTender($);

console.log(list);
