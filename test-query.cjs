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
    try {
      const parsed = JSON.parse(body);
      console.log(`Nodes: ${parsed.nodes ? parsed.nodes.length : 'none'}`);
      console.log(`Edges: ${parsed.edges ? parsed.edges.length : 'none'}`);
      if (parsed.nodes && parsed.nodes.length > 0) {
        console.log('Sample node:', parsed.nodes[0]);
      }
      if (parsed.edges && parsed.edges.length > 0) {
        console.log('Sample edge:', parsed.edges[0]);
      }
    } catch (e) {
      console.log('Failed to parse JSON:', e.message);
      console.log('Raw body:', body.substring(0, 500));
    }
  });
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
