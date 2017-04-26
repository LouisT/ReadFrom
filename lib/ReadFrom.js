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
      Stream = require('stream').Stream,
      DataFactory = require('./DataFactory.js');

class ReadFrom  {
      constructor (options = {}) {
          // Create a default settings object.
          this.settings = Object.assign({
              trim: true,     // If true trim() resulting data.
              empty: true,    // If true resolve on empty.
              pipe: null,     // Pipe to read data from. ('stdin', 'stdout', etc.)
              event: 'data',  // Event to read data from.
              flush: true     // Clear the DataFactory content after resolve.
          }, options);
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

          return this.spawn(app[0], app[1], Object.assign({}, this.settings, { empty: false }, options));
      }

      /*
       * Read from a specific file. The `reader` object in options is passed to the
       * fs.createReadStream() call. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.file(<Path>, <Options>).then(<FN>).catch(<FN>)
       */
      file (fpath, options = {}) {
          try {
             if ((!fpath || fpath.length === 0) || fs.accessSync(fpath, fs.R_OK)) {
                return Promise.reject(new Error('Must provide a path to an existing and readable file.'));
             }
           } catch (error) {
             return Promise.reject(error);
          }

          let opts = Object.assign({ reader: {} }, this.settings, options);

          return new DataFactory(fs.createReadStream(fpath, opts.reader), opts).Promose;
      }

      /*
       * Read STDOUT from a spawn() process. `Args` and `Options` are the arguments passed to
       * the child_process.spawn(<Command>[, <Args> [, <Options>]]) call.
       * https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_child_process_spawn_command_args_options
       */
      spawn (com, args = [], options = {}) {
          if (!com) {
             return Promise.reject(new Error('You must provide a valid shell command!'));
          }

          let opts = Object.assign({}, this.settings, { pipe: 'stdout' }, options);

          return new DataFactory(spawn(com, (Array.isArray(args) ? args : [args]), opts), opts).Promise;
      }

      /*
       * Read from a Stream. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.stream(<Stream>[, <Options>]).then(<FN>).catch(<FN>)
       */
      stream (stream, options = {}) {
          if (!(stream instanceof Stream && (typeof stream._read === 'function') && (typeof stream._readableState === 'object'))) {
             return Promise.reject(new Error('No valid Readable stream found!'));
          }

          let opts = Object.assign({}, this.settings, { event: 'readable' }, options);

          return new DataFactory(stream, opts, () => {
              return stream.read();
          }).Promise;
      }

      /*
       * Read from STDIN. If `trim` is true, run String.trim() on the results.
       * If `empty` is true allow the return of empty data.
       *    {Instance}.stdin(<Options>).then(<FN>).catch(<FN>)
       */
      stdin (options = {}) {
          if (Boolean(process.stdin.isTTY)) {
             return Promise.reject(new Error('No STDIN access.'));
          }

          let opts = Object.assign({}, this.settings, { event: 'readable' }, options);

          return new DataFactory(process.stdin, opts, () => {
              return process.stdin.read();
          }).Promise;
      }
}

/*
 * Export the module for use!
 */
module.exports = ReadFrom;
