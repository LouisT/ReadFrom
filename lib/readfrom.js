/*!
 * Read text content from different endpoints. - https://ltdev.im/ - Copyright (c) 2016 Louis T.
 * Licensed under MIT license https://raw.githubusercontent.com/LouisT/ReadFrom/master/LICENSE
 */
var fs = require('fs'),
    http = require('http'),
    https = require('https'),
    url = require('url'),
    spawn = require('child_process').spawn;

/*
 * The ReadFrom constructor. Options is an object with default return
 * instructions. If `trim` is true, run String.trim() on the results.
 * If `empty` is true allow the return of empty data.
 *    var {Instance} = new ReadFrom(<Options>)
 */
function ReadFrom (opts) {
         if (!(this instanceof ReadFrom)) {
            return new ReadFrom(opts);
         }

         // Set the default settings.
         this.settings = Object.assign({ trim: true, empty: true }, (opts || {}));

         // TODO: Add support for Windows users.
         this.clipboards = {
             linux: ['xclip', ['-selection', 'clipboard', '-o']],
             freebsd: ['xclip', ['-selection', 'clipboard', '-o']],
             darwin: ['pbpaste',[]],
         };
}

/*
 * Read from clipboard! Supports Linux/FreeBSD (xclip) and OSX (pbpaste).
 *    {Instance}.clipboard(<Options>).then(<FM>).catch(<FN>)
 */
ReadFrom.prototype.clipboard = function (opts) {
         var app;
         if (!(app = this.clipboards[process.platform.toLowerCase()])) {
            return Promise.reject(new Error('Your platform is not currently supported for clipboard access.'));
         }

         var opts = Object.assign({}, this.settings, (opts || {}), { empty: false }),
             deferred = Promise.defer(),
             buf = new Buffer(0);

         try {
            spawn(app[0], app[1]).stdout.on('data', function (chunk) {
                buf = Buffer.concat([buf, chunk]);
             }).on('end', (function (self) {
                return function () {
                    self.return(buf, opts, deferred);
                }
            })(this));
          } catch (error) {
            deferred.reject(error);
         }

         return deferred.promise;
};

/*
 * Read from a specific file. The `reader` object in options is passed to the
 * fs.createReadStream() call. If `trim` is true, run String.trim() on the results.
 * If `empty` is true allow the return of empty data.
 *    {Instance}.file(<Path>, <Options>).then(<FN>).catch(<FN>)
 */
ReadFrom.prototype.file = function (file, opts) {
         try {
            if ((!file || file.length === 0) || fs.accessSync(file, fs.R_OK)) {
               return Promise.reject(new Error('Must provide a path to an existing and readable file.'));
            }
          } catch (error) {
            return Promise.reject(error);
         }

         var opts = Object.assign({ reader: {} }, this.settings, (opts || {})),
             deferred = Promise.defer(),
             stream = fs.createReadStream(file, opts.reader),
             buf = new Buffer(0);

         stream.on('data', function (chunk) {
             buf = Buffer.concat([buf, chunk]);
          }).on('end', (function (self) {
             return function () {
                self.return(buf, opts, deferred);
             }
         })(this));

         return deferred.promise;
};

/*
 * Read from a STDIN. If `trim` is true, run String.trim() on the results.
 * If `empty` is true allow the return of empty data.
 *    {Instance}.stdin(<Options>).then(<FN>).catch(<FN>)
 */
ReadFrom.prototype.stdin = function (opts) {
         if (Boolean(process.stdin.isTTY)) {
            return Promise.reject(new Error('No STDIN access.'));
         }

         var opts = Object.assign({}, this.settings, (opts || {})),
             deferred = Promise.defer(),
             buf = new Buffer(0);

         process.stdin.on('readable', function (chunk) {
             if ((chunk =  process.stdin.read())) {
                buf = Buffer.concat([buf, chunk]);
             }
          }).on('end', (function (self) {
             return function () {
                self.return(buf, opts, deferred);
             }
          })(this)).on('error', function (error) {
             deferred.reject(error);
         });

         return deferred.promise;
};

/*
 * Read from a URL. Only support text/.* and application/json for now?
 *    {Instance}.url(<URL>, <Options>).then(<FN>).catch(<FN>)
 */
ReadFrom.prototype.url = function (addr, opts) {
         try {
            var request = url.parse(addr);
            // XXX: Validate the URL more.
            if ((!request.hostname || !/https?:/i.test(request.protocol))) {
               return Promise.reject(new Error('Invalid URL.'));
            }
          } catch (error) {
            return Promise.reject(error);
         }

         var opts = Object.assign({ types: ['text\/(\.*)', 'application/json'] }, this.settings, (opts || {})),
             deferred = Promise.defer(),
             buf = new Buffer(0);

         (request.protocol === 'https:'?https:http).request(request, (function (self) {
             return function (res) {
                try {
                   var regex = new RegExp('('+(Array.isArray(opts.types)?opts.types:[opts.types]).join('|')+')', 'i');
                   if (!regex.test(res.headers['content-type'])) {
                      return deferred.reject(new Error('Invalid Content-Type returned.'));
                   }
                 } catch (error) {
                   return deferred.reject(error);
                }
                res.on('data', function (chunk) {
                    buf = Buffer.concat([buf, chunk]);
                 }).on('end', function () {
                    self.return(buf, opts, deferred);
                });
             }
          })(this)).on('error', function (error) {
             deferred.reject(error);
          }).setTimeout((opts.timeout||5000), function () {
             if (!('abort' in opts) || opts.abort) {
                this.abort();
             }
             deferred.reject(new Error('Request has timed out.'));
         }).end();

         return deferred.promise;
};

/*
 * Standardizing the returned data from calls. This is meant to be an internal
 * function, should not need to use it elsewhere.
 *    {Instance}.return(<Buffer>, <Options>, <Deferrer>)
 */
ReadFrom.prototype.return = function (buf, opts, deferred) {
         try {
            var result = buf.toString('utf-8', 0)[opts.trim?'trim':'toString']();
            if ((!result || result.length === 0) && !opts.empty) {
               deferred.reject(new Error((opts.message || 'Returned string is empty.')));
             } else {
               deferred.resolve(result);
            }
          } catch (error) {
            deferred.reject(error);
         }
};

/*
 * Export the module for use!
 */
module.exports = ReadFrom;
