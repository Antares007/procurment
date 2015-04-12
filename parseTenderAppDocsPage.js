var $ = require('cheerio');
var cheerio = $;
var profileRegex = /^.+\((\d+)\)$/;
var parseDate = function (str) {
  var parts = str.split(/\.| /);
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]} ${parts[3]}`);
};

module.exports = function(htmlStr) {
  var $ = cheerio.load(htmlStr);
  return {
    'docs': $('#tender_docs')
      .first()
      .find('tbody tr')
      .map(function(){
        var tds = $(this).children();
        return {
          href: tds.eq(2).find('a').attr('href'),
          obsolete: tds.eq(2).hasClass('obsolete1'),
          name: tds.eq(2).find('a').contents().eq(3).text().trim(),
          date: parseDate(tds.eq(3).contents().eq(0).text()),
          author: tds.eq(3).contents().eq(2).text()
        }
      }).get(),
    'xdocs': $('#tender_xdocs')
      .first()
      .find('tbody tr')
      .map(function(){
        var tds = $(this).children();
        return {
          href: tds.eq(1).find('a').attr('href'),
          obsolete: tds.eq(1).hasClass('obsolete1'),
          name: tds.eq(1).find('a').contents().eq(3).text().trim(),
          date: parseDate(tds.eq(2).contents().eq(0).text()),
          author: tds.eq(2).contents().eq(2).text()
        }
      }).get()
  };
};

