const http = require('http');

exports.default = function runServer() {
    const hostname = process.env.HOST_NAME | '127.0.0.1';
    const port = process.env.PORT | 3000;

    const server = http.createServer((req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello World');
    });

    server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
    });
}