const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function debugScraper() {
  try {
    console.log('Fetching page...');
    const response = await axios.get('https://aws.amazon.com/jp/bedrock/pricing/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      timeout: 30000,
    });

    console.log('Page fetched, saving HTML...');
    fs.writeFileSync('./debug/page.html', response.data);

    const $ = cheerio.load(response.data);

    console.log('\n=== Tables found ===');
    $('table').each((i, table) => {
      console.log(`\nTable ${i + 1}:`);
      const $table = $(table);

      // Headers
      const headers = [];
      $table.find('thead tr th, thead tr td, tr:first-child th, tr:first-child td').each((_, th) => {
        headers.push($(th).text().trim());
      });
      console.log('Headers:', headers);

      // First few rows
      $table.find('tbody tr, tr').slice(0, 3).each((j, row) => {
        const cells = [];
        $(row).find('td, th').each((_, cell) => {
          cells.push($(cell).text().trim().substring(0, 50));
        });
        if (cells.length > 0) {
          console.log(`Row ${j + 1}:`, cells);
        }
      });
    });

    console.log('\n=== Headings with pricing info ===');
    $('h1, h2, h3, h4').each((i, heading) => {
      const text = $(heading).text().trim();
      if (text.includes('価格') || text.includes('料金') || text.includes('Price') ||
          text.includes('Claude') || text.includes('Titan') || text.includes('モデル')) {
        console.log(`${heading.name}: ${text}`);

        // Check next elements
        let next = $(heading).next();
        for (let j = 0; j < 3; j++) {
          if (next.length > 0) {
            const nextText = next.text().trim().substring(0, 100);
            if (nextText) {
              console.log(`  Next ${j + 1} (${next.prop('tagName')}): ${nextText}`);
            }
            next = next.next();
          }
        }
      }
    });

    console.log('\n=== Divs with pricing classes ===');
    $('div[class*="price"], div[class*="pricing"], div[class*="model"]').slice(0, 5).each((i, div) => {
      console.log(`Div ${i + 1} classes:`, $(div).attr('class'));
      console.log('Content:', $(div).text().trim().substring(0, 100));
    });

    console.log('\nHTML saved to debug/page.html');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugScraper();
