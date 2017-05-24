/*!
 * Read text content from different endpoints. - https://ltdev.im/ - Copyright (c) 2016 Louis T.
 * Licensed under MIT license https://raw.githubusercontent.com/LouisT/ReadFrom/master/LICENSE
 */
'use strict';
const ReadFrom = require('../'),
      assert = require('assert'),
      net = require('net'),
      http = require('http'),
      fs = require('fs'),
      testloc = require('path').basename(__dirname);

/*
 * Create a test HTTP server for #url().
 */
const HTTPserver = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('OK\r\n');
});
HTTPserver.listen(8080, '127.0.0.1');

describe('ReadFrom', () => {
    describe('#file()', () => {
        it('should read from a file as a Promise', () => {
            return new ReadFrom().file(`${testloc}/file.txt`).then((data) => {
                assert.equal(data.trim(), 'OK');
            });
        });
        it('should read from a file one line at a time', () => {
            let matched = false;
            return new ReadFrom().file(`${testloc}/file.txt`, undefined, (line) => {
                matched = (line.trim() === 'OK');
             }).then(() => {
                return matched ? Promise.resolve(true) : Promise.reject('Line did not match.');
            });
        });
    });
    describe('#url()', () => {
        it('should read from a URL as a Promise', () => {
            return new ReadFrom().url('http://127.0.0.1:8080/').then((data) => {
                assert.equal(data.trim(), 'OK');
            });
        });
        it('should read from a URL one line at a time', () => {
            let hadline = false;
            return new ReadFrom().url('http://127.0.0.1:8080/', undefined, (line) => {
                assert.equal(line.trim(), 'OK');
            });
        });
        after(() => {
            HTTPserver.close();
        });
    });
    describe('#stream()', () => {
        it('should read from a stream as a Promise', () => {
            let Readable = require('stream').Readable,
                Stream = new Readable;
            Stream._read = ((c, m) => {
                return () => { Stream.push((c <= m ? Buffer.from(String(c++)) : null)); }
            })(0, 9);
            return new ReadFrom().stream(Stream).then((data) => {
                assert.equal(data.length == 10, true);
            });
        });
        it('should read from a stream one line at a time', () => {
            let Readable = require('stream').Readable,
                Stream = new Readable;
            Stream._read = ((c, m) => {
                return () => { Stream.push((c <= m ? Buffer.from(String(c++)) : null)); }
            })(0, 9);
            return new ReadFrom().stream(Stream, undefined, (num) => {
                assert.equal(num, 0); // Find the first number (0)
            });
        });
    });
    describe('#port()', () => {
        it('should read from a port as a Promise', () => {
            let onlisten = (port) => {
                let client = net.createConnection({ port: port }, () => {
                    client.end('OK\r\n');
                });
            };
            return new ReadFrom().port(8080, { address: '127.0.0.1', onlisten: onlisten }).then((data) => {
                assert.equal(data.trim(), 'OK');
            });
        });
        it('should read from a port one line at a time', () => {
            let onlisten = (port) => {
                    let client = net.createConnection({ port: port }, () => {
                        client.end('OK\r\n');
                    });
                }, matched = false;
            return new ReadFrom().port(8080, { address: '127.0.0.1', onlisten: onlisten }, (line) => {
                matched = (line.trim() === 'OK');
             }).then(() => {
                return matched ? Promise.resolve(true) : Promise.reject('Line did not match.');
            });
        });
    });
    describe('#unixSocket()', () => {
        it('should read from a unix socket as a Promise', () => {
            let onlisten = (path) => {
                let client = net.connect(path, () => {
                    client.end('OK');
                });
            };
            return new ReadFrom().unixSocket('./ReadFrom.sock', { onlisten: onlisten }).then((data) => {
                assert.equal(data, 'OK');
            });
        });
        it('should read from a unix socket line by line', () => {
            let onlisten = (path) => {
                let client = net.connect(path, () => {
                    client.end('OK');
                });
            };
            new ReadFrom().unixSocket('./ReadFrom.sock', { onlisten: onlisten }, (line) => {
                assert.equal(data, 'OK');
            });
        });
        beforeEach(() => {
            if (fs.existsSync('./ReadFrom.sock')) {
               fs.unlinkSync('./ReadFrom.sock');
            }
        });
        afterEach(() => {
            if (fs.existsSync('./ReadFrom.sock')) {
               fs.unlinkSync('./ReadFrom.sock');
            }
        });
    });
});
