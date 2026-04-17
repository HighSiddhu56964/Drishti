const http = require('http');

const data = JSON.stringify({ query: 'Iran and US' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/graph/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${body.substring(0, 1000)}`);
  });
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
