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
    'ანგარიშები': $('#reports')
      .first()
      .find('tbody tr')
      .map(function(){
        var tds = $(this).children();
        var dateAndAuthor = tds.eq(3).text().split('::');
        return {
          href: tds.eq(2).find('a').attr('href'),
          obsolete: tds.eq(2).hasClass('obsolete1'),
          name: tds.eq(2).find('a').text().trim(),
          date: parseDate(dateAndAuthor[0]),
          author: dateAndAuthor[1].trim()
        }
      }).get(),
    'დისკვალიფიცირებულები': $('table')
      .filter(function(){
        return $(this).find('td').eq(2).text().indexOf('დისკვალიფიკაცია') >= 0;
      })
      .first()
      .find('tr')
      .map(function(){
        var tds = $(this).children();
        return {
          'თარიღი': parseDate(tds.eq(0).text()),
          'კომპანია': tds.eq(1).text(),
          'მიზეზი': tds.eq(2).text()
        }
      }).get()
  };
};
