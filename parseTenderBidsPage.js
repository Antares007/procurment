var $ = require('cheerio');
var cheerio = $;
var textTrim = function(td){
  return td.text().trim();
};
var parseDate = function (str) {
  var parts = str.split(/\.| /);
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]} ${parts[3]}`);
};
var parseAmount = function (str) {
  var parts = str.replace(/`/g,'').split(' ');
  return {amount:parseFloat(parts[0]), currency:parts[1]};
};

module.exports = function(htmlStr) {
  var $ = cheerio.load(htmlStr);
  return $('table').filter(function() {
    var cols = $(this).find('thead tr td');
    return cols.eq(0).text() === 'პრეტენდენტი' &&
    cols.eq(1).text() === 'ბოლო შეთავაზებათანხა/დრო' &&
    cols.eq(2).text() === 'პირველი შეთავაზებათანხა/დრო' &&
    cols.eq(3).text() === 'შეთავაზებები'
  }).first()
  .find('tbody tr')
  .map(function(){
    var tds = $(this).find('td');
    var onclick = tds.eq(0).find('a').attr('onclick');
    return {
      'პრეტენდენტი': {
        'დასახელება': tds.eq(0).find('span').text(),
        id: /^.+\((\d+)\)$/.exec(onclick)[1]
      },
      'ბოლო შეთავაზება': {
        'თანხა': parseFloat(tds.eq(1).find('strong').text().replace(/`/g,'')),
        'დრო': parseDate(tds.eq(1).find('span').text()),
      },
      'პირველი შეთავაზება': {
        'თანხა': parseFloat(tds.eq(2).text().split(String.fromCharCode(160))[0].replace(/`/g,'')),
        'დრო': parseDate(tds.eq(2).find('span').text()),
      }
    };
  }).get()
};
