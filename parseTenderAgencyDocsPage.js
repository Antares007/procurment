var $ = require('cheerio');
var cheerio = $;
var profileRegex = /^.+\((\d+)\)$/;
var parseDate = function (str) {
  var parts = str.split(/\.| /);
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]} ${parts[3]}`);
};

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
  var amountanddate = td.find('span[class="convertme"]').first().attr('id').split('-');
  return {
    id: profileRegex.exec(td.find('a').first().attr('onclick'))[1],
    'დასახელება': td.find('strong').first().text(),
    'თანხა': {
      amount: parseFloat(amountanddate[0], 10),
      currency: amountanddate[1],
    }, 
    'თარიღი': parseDate(amountanddate[2])

  }
};

