/*!
 * Read text content from different endpoints. - https://ltdev.im/ - Copyright (c) 2016 Louis T.
 * Licensed under MIT license https://raw.githubusercontent.com/LouisT/ReadFrom/master/LICENSE
 */
var fs = require('fs'),
    http = require('http'),
    https = require('https'),
    url = require('url'),
    spawn = require('child_process').spawn,
    stream = require('stream');

/*
 * The ReadFrom constructor. Options is an object with default return
 * instructions. If `trim` is true, run String.trim() on the results.
 * If `empty` is true allow the return of empty data.
 *    var {Instance} = new ReadFrom(<Options>)
 */
function ReadFrom (options) {
         if (!(this instanceof ReadFrom)) {
            return new ReadFrom(options);
         }

         // Set the default settings.
         this.settings = Object.assign({ trim: true, empty: true }, (options || {}));

         // List of platform commands to read from clipboard.
         // XXX: Windows (win32) can be slow, need to figure out a faster option.
         this.clipboards = {
             linux: ['xclip', ['-selection', 'clipboard', '-o']],
             freebsd: ['xclip', ['-selection', 'clipboard', '-o']],
             darwin: ['pbpaste',[]],
             win32: ['PowerShell', ['-Command', '& {Add-Type -Assembly PresentationCore; [Windows.Clipboard]::GetText()}']]
         };

         // The list of available methods.
         this.methods = Object.getOwnPropertyNames(ReadFrom.prototype).filter(function (key) {
             // Filter out properties that should not be listed/called.
             return ['constructor', 'return'].indexOf(key) < 0;
         });
}

/*
 * Read from clipboard! Supports Linux/FreeBSD (xclip) and OSX (pbpaste).
 *    {Instance}.clipboard(<Options>).then(<FM>).catch(<FN>)
 */
ReadFrom.prototype.clipboard = function (options) {
         var app;
         if (!(app = this.clipboards[process.platform.toLowerCase()])) {
            return Promise.reject(new Error('Your platform is not currently supported for clipboard access.'));
         }

         return this.spawn(app[0], app[1], Object.assign({}, this.settings, (options || {}), { empty: false }));
};

/*
 * Read from a specific file. The `reader` object in options is passed to the
 * fs.createReadStream() call. If `trim` is true, run String.trim() on the results.
 * If `empty` is true allow the return of empty data.
 *    {Instance}.file(<Path>, <Options>).then(<FN>).catch(<FN>)
 */
ReadFrom.prototype.file = function (file, options) {
         return new Promise((function (self) {
             return function (resolve, reject) {
                 try {
                    if ((!file || file.length === 0) || fs.accessSync(file, fs.R_OK)) {
                       return reject(new Error('Must provide a path to an existing and readable file.'));
                    }
                  } catch (error) {
                    return reject(error);
                 }

                 var opts = Object.assign({ reader: {} }, self.settings, (options || {})),
                     rstream = fs.createReadStream(file, opts.reader),
                     buf = Buffer.alloc(0);

                 rstream.on('data', function (chunk) {
                     buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                  }).on('end', function () {
                     self.return(buf, opts, resolve, reject);
                 });
             }
         })(this));
};

/*
 * Read STDOUT from a spawn() process. `Args` and `Options` are the arguments passed to
 * the child_process.spawn(<Command>[, <Args> [, <Options>]]) call.
 * https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_child_process_spawn_command_args_options
 */
ReadFrom.prototype.spawn = function (com, args, options) {
         return new Promise((function (self) {
             return function (resolve, reject) {
                 if (!com) {
                    return reject(new Error('You must provide a valid shell command!'));
                 }

                 var opts = Object.assign({}, self.settings, (options || {})),
                     buf = Buffer.alloc(0);

                 try {
                    spawn(com, (args ? (Array.isArray(args) ? args : [args]) : []), opts).stdout.on('data', function (chunk) {
                        buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                     }).on('end', function () {
                        self.return(buf, opts, resolve, reject);
                    });
                  } catch (error) {
                    reject(error);
                 }
              }
         })(this));
};

/*
 * Read from a Stream. If `trim` is true, run String.trim() on the results.
 * If `empty` is true allow the return of empty data.
 *    {Instance}.stream(<Stream>[, <Options>]).then(<FN>).catch(<FN>)
 */
ReadFrom.prototype.stream = function (input, options) {
         return new Promise((function (self) {
             return function (resolve, reject) {
                 if (!(input instanceof stream.Stream && (typeof input._read === 'function') && (typeof input._readableState === 'object'))) {
                    return reject(new Error('No valid Readable stream found!'));
                 }

                 var opts = Object.assign({}, self.settings, (options || {})),
                     buf = Buffer.alloc(0);

                 input.on('readable', function (chunk) {
                     if ((chunk = input.read())) {
                        buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                     }
                  }).on('end', function () {
                     self.return(buf, opts, resolve, reject);
                  }).on('error', function (error) {
                     reject(error);
                 });
             }
         })(this));
};

/*
 * Read from a STDIN. If `trim` is true, run String.trim() on the results.
 * If `empty` is true allow the return of empty data.
 *    {Instance}.stdin(<Options>).then(<FN>).catch(<FN>)
 */
ReadFrom.prototype.stdin = function (options) {
         return new Promise((function (self) {
             return function (resolve, reject) {
                 if (Boolean(process.stdin.isTTY)) {
                    return reject(new Error('No STDIN access.'));
                 }

                 var opts = Object.assign({}, self.settings, (options || {})),
                     buf = Buffer.alloc(0);

                 process.stdin.on('readable', function (chunk) {
                     if ((chunk =  process.stdin.read())) {
                        buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                     }
                  }).on('end', function () {
                     self.return(buf, opts, resolve, reject);
                  }).on('error', function (error) {
                     reject(error);
                 });
             }
         })(this));
};

/*
 * Read from an SSH server. If `trim` is true, run String.trim() on the results.
 * If `empty` is true allow the return of empty data.
 *    {Instance}.ssh(<Command>, <SSH Options>[, <Options>]).then(<FN>).catch(<FN>)
 *
 *    NOTE: The promise returns the following object:
 *          { stdout: <String>, stderr: <String>, code: <Int>, signal: <String|Undefined> }
 */
ReadFrom.prototype.ssh = function (cmd, sshoptions, options) {
         var Client = require('ssh2').Client;
             ssh = new Client();
         return new Promise((function (self) {
             return function (resolve, reject) {

                 var opts = Object.assign({}, self.settings, (options || {})),
                     buf = Buffer.alloc(0), ebuf = Buffer.alloc(0);

                 ssh.on('ready', function () {
                     ssh.exec(cmd, function (error, stream) {
                         if (error) {
                            return reject(error, ssh.end());
                          } else {
                            stream.on('close', function (code, signal) {
                                ssh.end();
                                try {
                                   var stdout = buf.toString('utf-8', 0)[opts.trim?'trim':'toString'](),
                                       stderr = ebuf.toString('utf-8', 0)[opts.trim?'trim':'toString']();
                                   resolve({ stdout: stdout, stderr: stderr, code: code, signal: signal });
                                 } catch (error) {
                                   return reject(error);
                                }
                             }).on('data', function (chunk) {
                                buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                             }).stderr.on('data', function (echunk) {
                                ebuf = Buffer.concat([ebuf, echunk], ebuf.length + echunk.length);
                            });
                         }
                     });
                  }).on('error', function (error) {
                     reject(error);
                 }).connect(sshoptions);
             }
         })(this));
};


/*
 * Read from a URL. Only support text/.* and application/json for now?
 *    {Instance}.url(<URL>[, <Options>]).then(<FN>).catch(<FN>)
 */
ReadFrom.prototype.url = function (addr, options) {
         return new Promise((function (self) {
             return function (resolve, reject) {
                 try {
                    var request = url.parse(addr);
                    // XXX: Validate the URL more.
                    if ((!request.hostname || !/https?:/i.test(request.protocol))) {
                       return reject(new Error('Invalid URL.'));
                    }
                  } catch (error) {
                    return reject(error);
                 }

                 var opts = Object.assign({ types: ['text\/(\.*)', 'application/json'] }, self.settings, (options || {})),
                     buf = Buffer.alloc(0);

                 (request.protocol === 'https:'?https:http).request(request, function (res) {
                     try {
                        var regex = new RegExp('('+(Array.isArray(opts.types) ? opts.types : [opts.types]).join('|')+')', 'i');
                        if (!regex.test(res.headers['content-type'])) {
                           return reject(new Error('Invalid Content-Type returned.'));
                        }
                      } catch (error) {
                        return reject(error);
                     }
                     res.on('data', function (chunk) {
                         buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                      }).on('end', function () {
                         self.return(buf, opts, resolve, reject);
                     });
                  }).on('error', function (error) {
                     reject(error);
                  }).setTimeout((opts.timeout||5000), function () {
                     if (!('abort' in opts) || opts.abort) {
                        this.abort();
                     }
                     reject(new Error('Request has timed out.'));
                 }).end();
             }
         })(this));
};

/*
 * Standardizing the returned data from calls. This is meant to be an internal
 * function, should not need to use it elsewhere.
 *    {Instance}.return(<Buffer>, <Options>, <Resolve>, <Reject>)
 */
ReadFrom.prototype.return = function (buf, opts, resolve, reject) {
         try {
            var result = buf.toString('utf-8', 0)[opts.trim?'trim':'toString']();
            if ((!result || result.length === 0) && !opts.empty) {
               reject(new Error((opts.message || 'Returned string is empty.')));
             } else {
               resolve(result);
            }
          } catch (error) {
            reject(error);
         }
};

/*
 * Export the module for use!
 */
module.exports = ReadFrom;
