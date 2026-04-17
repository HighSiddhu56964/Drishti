const http = require('http');
const options = {
  hostname: 'localhost', port: 3000,
  path: '/graph/entity/' + encodeURIComponent('Iran'),
  method: 'GET',
  headers: { 'Accept': 'application/json' }
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const p = JSON.parse(body);
      console.log('Title:', p.title);
      console.log('Summary:', (p.summary || '').substring(0, 80));
      console.log('Thumb:', p.thumbnail ? 'YES' : 'NO');
      console.log('URL:', p.url);
      console.log('Extract:', (p.extract || '').substring(0, 120) + '...');
    } catch(e) { console.log('Parse error:', body.substring(0,200)); }
  });
});
req.on('error', e => console.error(e));
req.end();
