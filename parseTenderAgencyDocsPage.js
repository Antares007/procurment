var $ = require('cheerio');
var cheerio = $;
var profileRegex = /^.+\((\d+)\)$/;

module.exports = function(htmlStr) {
  var $ = cheerio.load(htmlStr);
  var td = $('table').filter(function() {
    return profileRegex.test($(this).find('tr td a').first().attr('onclick'));
  }).first()
  .find('tr td')
  .first();
  if(td.length === 0) {
    return;
  }
  return {
    id: profileRegex.exec(td.find('a').first().attr('onclick'))[1],
    'დასახელება': td.find('strong').first().text()
  }
};

