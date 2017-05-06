/*!
 * Read text content from different endpoints. - https://ltdev.im/ - Copyright (c) 2016 Louis T.
 * Licensed under MIT license https://raw.githubusercontent.com/LouisT/ReadFrom/master/LICENSE
 */
"use strict";
const fs = require('fs'),
      http = require('http'),
      https = require('https'),
      net = require('net'),
      url = require('url'),
      util = require('util'),
      spawn = require('child_process').spawn,
      Stream = require('stream').Stream,
      DataFactory = require('./DataFactory.js'),
      SSHPromise = require('./SSHPromise.js');

class ReadFrom  {
      constructor (options = {}) {
          // Create a default settings object.
          this.settings = Object.assign({
              trim: true,      // If true trim() resulting data.
              empty: true,     // If true resolve on empty.
              pipe: null,      // Pipe to read data from. ('stdin', 'stdout', etc.)
              event: 'data',   // Event to read data from.
              flush: true,     // Clear the DataFactory content after resolve.
              separator: '\n'  // The line separator used for the line parsers.
          }, options);

          // Map for holding TCP server instances.
          this._tcpServers = new Map();
      }

      // List of platform commands to read from clipboard.
      get clipboards () {
          return {
              linux: ['xclip', ['-selection', 'clipboard', '-o']],
              freebsd: ['xclip', ['-selection', 'clipboard', '-o']],
              darwin: ['pbpaste', []],
              // XXX: Windows (win32) can be slow, need to figure out a faster option.
              win32: ['PowerShell', ['-Command', '& {Add-Type -Assembly PresentationCore; [Windows.Clipboard]::GetText()}']]
          };
      }

      // List of available methods that can be used to read from resources.
      get methods () {
          // Build a list of available methods from the ReadFrom prototype.
          return Object.getOwnPropertyNames(this.constructor.prototype).filter((key) => {
              // Filter out properties that should not be listed/called outside of the class.
              return !Object.getOwnPropertyDescriptor(this.constructor.prototype, key).get && ['constructor', 'return'].indexOf(key) < 0;
          });
      }

      /*
       * Read from clipboard! Supports Linux/FreeBSD (xclip) and OSX (pbpaste).
       *    {Instance}.clipboard(<Options>[, <Line Parser>]).then(<FM>).catch(<FN>)
       */
      clipboard (options = {}, lineParser = false, app = this.clipboards[process.platform.toLowerCase()]) {
          if (!Array.isArray(app)) {
             return Promise.reject(new Error(util.format('Your platform (%s) is not currently supported for clipboard access.', process.platform)));
          }

          return this.spawn(app[0], app[1], Object.assign({}, this.settings, { empty: false }, options), lineParser);
      }

      /*
       * Read from a specific file. The `reader` object in options is passed to the
       * fs.createReadStream() call. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.file(<Path>[, <Options>[, <Line Parser>]]).then(<FN>).catch(<FN>)
       */
      file (fpath, options = {}, lineParser = false) {
          try {
             if ((!fpath || fpath.length === 0) || fs.accessSync(fpath, fs.R_OK)) {
                return Promise.reject(new Error(util.format('%s does not exist.', fpath)));
             }
           } catch (error) {
             return Promise.reject(error);
          }

          let opts = Object.assign({ reader: {} }, this.settings, options);

          return new DataFactory(fs.createReadStream(fpath, opts.reader), opts, undefined, lineParser).Promise;
      }

      /*
       * Read STDOUT from a spawn() process. `Args` and `Options` are the arguments passed to
       * the child_process.spawn(<Command>[, <Args>[, <Options>[, <Line Parser>]]]) call.
       * https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_child_process_spawn_command_args_options
       */
      spawn (com, args = [], options = {}, lineParser = false) {
          if (!com) {
             return Promise.reject(new Error('You must provide a valid shell command!'));
          }

          let opts = Object.assign({}, this.settings, options, { pipe: 'stdout' });

          return new DataFactory(spawn(com, (Array.isArray(args) ? args : [args]), opts), opts, undefined, lineParser).Promise;
      }

      /*
       * Read from a Stream. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.stream(<Stream>[, <Options> [, <Line Parser>]]).then(<FN>).catch(<FN>)
       */
      stream (readable, options = {}, lineParser = false) {
          if (!(readable instanceof Stream && (typeof readable._read === 'function') && (typeof readable._readableState === 'object'))) {
             return Promise.reject(new Error('No valid Readable stream found!'));
          }

          let opts = Object.assign({}, this.settings, { event: 'readable' }, options);

          return new DataFactory(readable, opts, (chunk) => {
              return readable.read();
          }, lineParser).Promise;
      }

      /*
       * Read from STDIN. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.stdin(<Options>[, <Line Parser>]).then(<FN>).catch(<FN>)
       */
      stdin (options = {}, lineParser = false) {
          if (Boolean(process.stdin.isTTY)) {
             return Promise.reject(new Error('No STDIN access.'));
          }

          let opts = Object.assign({}, this.settings, { event: 'readable' }, options);

          return new DataFactory(process.stdin, opts, () => {
              return process.stdin.read();
          }, lineParser).Promise;
      }


      /*
       * Getter/Setter for TCP (and UNIX domain socket) servers, used for managing port() and unixSocket() servers.
       *   {Instance}.tcpServer(<Port / Socket>[, <Address>[, <Server Instance>]]);
       */
      tcpServers (port, address = null, inst = null) {
          let key = (address ? [address, port] : [port]).join(':');
          if (port && inst) {
             this._tcpServers.set(key, inst);
          }
          return ((serv, obj) => {
              for (var i in obj) {
                  if (obj.hasOwnProperty(i)) {
                     serv[i] = obj[i];
                  }
              }
              return serv;
           })(this._tcpServers.get(key) || {}, {
              // Check if the address:port combo exists.
              exists: () => {
                  return (this._tcpServers.has(key) ? key : false);
              },
              // If remove(true) return a promise.
              remove: (p) => {
                  let _remove = (ended = false, _sock = this._tcpServers.get(key)) => {
                      try {
                          if (_sock && !_sock._end) {
                             _sock._end = _sock.close();
                          }
                      } catch (error) { /* Doesn't matter, remove the key. */ }
                      return this._tcpServers.delete(key);
                  };
                  return (p ? new Promise((resolve, reject) => {
                      return (_remove() ? resolve(true) : reject(false));
                  }) : _remove());
              }
          });
      }

      /*
       * Read from a TCP port. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.port(<Port>[, <Options>[, <Line Parser>]]).then(<FN>).catch(<FN>)
       */
      port(port = 8880, options = {}, lineParser = false) {
          if (isNaN(Number(parseInt(port, 10))) && !options.unix) {
             return Promise.reject(new Error(util.format('Invalid port (%s) supplied!', port)));
          }

          let opts = Object.assign({ address: '0.0.0.0', separator: '\n' }, this.settings, options),
              ref = { port: port, address: opts.address },
              DF = new DataFactory();

          if (opts.key = this.tcpServers(port, opts.address).exists()) {
             return DF.reject(new Error(util.format('TCP socket (%s) already in use!', opts.key)), true);
          }
          this.tcpServers(port, opts.address, net.createServer((socket) => {
              socket.on('end', () => {
                  if (!opts.keepalive) {
                     this.tcpServers(port, opts.address).remove(true);
                  }
               }).on('error', (error) => {
                  DF.reject(error);
              });
              DF.read(socket, opts, undefined, lineParser);
           })).on('close', () => {
              this.tcpServers(port, opts.address).remove();
              DF.resolve(DF.compile(undefined, opts));
           }).on('error', (error) => {
              this.tcpServers(port, opts.address).remove();
              DF.reject(error);
           }).listen(port, opts.address, () => {
              if (opts.verbose) {
                 console.log('ReadFrom listening on %s', (opts.address ? [opts.address, port] : [port]).join(':'));
              }
              if (opts.unix) {
                 process.on('exit', (code) => {
                     try {
                         fs.unlinkSync(port);
                     } catch (error) { }
                  }).on('SIGINT', (code) => {
                     process.exit(code);
                 });
              }
          });
          return DF.Promise;
      }

      /*
       * Alias of port(), read from a UNIX socket. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.unixSocket(<Socket>[, <Options>[, <Line Parser>]]).then(<FN>).catch(<FN>)
       */
      unixSocket (socket = "/tmp/ReadFrom.sock", options = {}, lineParser = false) {
          return new Promise((resolve, reject) => {
              fs.access(socket, fs.constants.F_OK, (err) => {
                  if (!err) {
                     return reject(new Error(util.format('%s already exists.', socket)));
                  }
                  return resolve(this.port(socket, Object.assign({}, options, { address: false, unix: true }), lineParser));
              });
          });
      }

      /*
       * Read from a URL; options.types being an array of allowed Content-Type responses.
       * NOTE: Default types: text/*, application/json
       *    {Instance}.url(<URL>[, <Options>[, <Line Parser>]]).then(<FN>).catch(<FN>)
       */
      url (link, options = {}, lineParser = false) {
          let request = url.parse(link);
          // XXX: Validate the URL more; perhaps RegEx?
          if ((!request.hostname || !/https?:/i.test(request.protocol))) {
             return Promise.reject(new Error('Invalid URL.'));
          }

          let opts = Object.assign({ types: ['text\/(\.*)', 'application/json'], timeout: 5000 }, this.settings, options, { keepalive: false }),
              DF = new DataFactory();

          (request.protocol === 'https:'?https:http).request(request, function (res) {
              try {
                  var regex = new RegExp('('+(Array.isArray(opts.types) ? opts.types : [opts.types]).join('|')+')', 'i');
                  if (!regex.test(res.headers['content-type'])) {
                     return DF.reject(new Error('Invalid Content-Type returned.'));
                  }
                } catch (error) {
                  return DF.reject(error);
              }
              DF.read(res, opts, undefined, lineParser);
           }).on('error', function (error) {
              DF.reject(error);
           }).setTimeout(opts.timeout, function () {
              if (!('abort' in opts) || opts.abort) {
                 this.abort();
              }
              DF.reject(new Error('Request has timed out.'));
          }).end();
          return DF.Promise;
      }

      /*
       * Read from an SSH server. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data. 'Commands' can be a string or array.
       * If `combine` is passed in SSH options, the commands Array will be joined by that string. (;, &&, etc.)
       *    {Instance}.ssh(<Commands>, <SSH Options>[, <Options>]).then(<FN>).catch(<FN>)
       *
       *    NOTE: The Promise returns an Array with the following object(s):
       *          { stdout: <String>, stderr: <String>, code: <Int>, signal: <String|Undefined> }
       */
      ssh (commands, sshoptions = {}, options = {}) {

          // XXX: Validate `sshoptions/options.`

          return Promise.all(SSHPromise.compile(commands, sshoptions).map((command) => {
              return new SSHPromise(DataFactory).execute(command, sshoptions, options);
          }));
      }
}

/*
 * Export the module for use!
 */
module.exports = ReadFrom;
