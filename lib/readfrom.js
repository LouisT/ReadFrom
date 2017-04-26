/*!
 * Read text content from different endpoints. - https://ltdev.im/ - Copyright (c) 2016 Louis T.
 * Licensed under MIT license https://raw.githubusercontent.com/LouisT/ReadFrom/master/LICENSE
 */
"use strict";
const fs = require('fs'),
      http = require('http'),
      https = require('https'),
      url = require('url'),
      spawn = require('child_process').spawn,
      stream = require('stream');

class ReadFrom {
      constructor (options = {}) {
          // Create a default settings object.
          this.settings = Object.assign({ trim: true, empty: true }, options);
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
       *    {Instance}.clipboard(<Options>).then(<FM>).catch(<FN>)
       */
      clipboard (options = {}, app = this.clipboards[process.platform.toLowerCase()]) {
         if (!Array.isArray(app)) {
            return Promise.reject(new Error('Your platform is not currently supported for clipboard access.'));
         }

         return this.spawn(app[0], app[1], Object.assign({}, this.settings, options, { empty: false }));
      }

      /*
       * Read from a specific file. The `reader` object in options is passed to the
       * fs.createReadStream() call. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.file(<Path>, <Options>).then(<FN>).catch(<FN>)
       */
      file (fpath, options = {}) {
          return new Promise((resolve, reject) => {
              try {
                 if ((!fpath || fpath.length === 0) || fs.accessSync(fpath, fs.R_OK)) {
                    return reject(new Error('Must provide a path to an existing and readable file.'));
                 }
               } catch (error) {
                 return reject(error);
              }

              let opts = Object.assign({ reader: {} }, this.settings, options),
                  rstream = fs.createReadStream(fpath, opts.reader),
                  buf = Buffer.alloc(0);

              rstream.on('data', (chunk) => {
                  buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
               }).on('end', () => {
                  this.return(buf, opts, resolve, reject);
              });
          });
      }

      /*
       * Read STDOUT from a spawn() process. `Args` and `Options` are the arguments passed to
       * the child_process.spawn(<Command>[, <Args> [, <Options>]]) call.
       * https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_child_process_spawn_command_args_options
       */
      spawn (com, args = [], options = {}) {
          return new Promise((resolve, reject) => {
              if (!com) {
                 return reject(new Error('You must provide a valid shell command!'));
              }

              let opts = Object.assign({}, this.settings, options),
                  buf = Buffer.alloc(0);

              try {
                  spawn(com, (Array.isArray(args) ? args : [args]), opts).on('error', (error) => {
                     reject(error);
                   }).stdout.on('data', (chunk) => {
                     buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                   }).on('end', () => {
                     this.return(buf, opts, resolve, reject);
                  });
               } catch (error) {
                 reject(error);
              }
          });
      }

      /*
       * Read from a Stream. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.stream(<Stream>[, <Options>]).then(<FN>).catch(<FN>)
       */
      stream (input, options = {}) {
          return new Promise((resolve, reject) => {
              if (!(input instanceof stream.Stream && (typeof input._read === 'function') && (typeof input._readableState === 'object'))) {
                 return reject(new Error('No valid Readable stream found!'));
              }

              let opts = Object.assign({}, this.settings, options),
                  buf = Buffer.alloc(0);

              input.on('readable', (chunk) => {
                  if ((chunk = input.read())) {
                     buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                  }
               }).on('end', () => {
                  this.return(buf, opts, resolve, reject);
               }).on('error', (error) => {
                  reject(error);
              });
          });
      }

      /*
       * Read from STDIN. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.stdin(<Options>).then(<FN>).catch(<FN>)
       */
      stdin (options = {}) {
          return new Promise((resolve, reject) => {
              if (Boolean(process.stdin.isTTY)) {
                 return reject(new Error('No STDIN access.'));
              }

              let opts = Object.assign({}, this.settings, options),
                  buf = Buffer.alloc(0);

              process.stdin.on('readable', (chunk) => {
                  if ((chunk =  process.stdin.read())) {
                     buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
                  }
               }).on('end', () => {
                  this.return(buf, opts, resolve, reject);
               }).on('error', (error) => {
                  reject(error);
              });
          });
      }

      /*
       * Standardizing the returned data from calls. This is meant to be an internal
       * function, should not need to use it elsewhere.
       *    {Instance}.return(<Buffer>, <Options>, <Resolve>, <Reject>)
       */
      return (buf, opts, resolve, reject) {
         try {
            let result = buf.toString('utf-8', 0)[opts.trim?'trim':'toString']();
            if ((!result || result.length === 0) && !opts.empty) {
               reject(new Error((opts.message || 'Returned string is empty.')));
             } else {
               resolve(result);
            }
          } catch (error) {
            reject(error);
         }
      }
};

/*
 * Export the module for use!
 */
module.exports = ReadFrom;
