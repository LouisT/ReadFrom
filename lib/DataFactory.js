/*!
 * Read text content from different endpoints. - https://ltdev.im/ - Copyright (c) 2016 Louis T.
 * Licensed under MIT license https://raw.githubusercontent.com/LouisT/ReadFrom/master/LICENSE
 */
"use strict";

class DataFactory {
      constructor (emitter = null, options = {}, process = (data) => { return data; }) {
          this.buffer = Buffer.alloc(0);
          this.addPromise((p) => {
              if (emitter) {
                 this.read(emitter, options, process);
              }
          });
      }

      // Read data from the supplied emitter based on the event name and pipe.
      read(emitter, options = {}, process = (data) => { return data; }) {
          (options.pipe ? emitter[options.pipe] : emitter).on(options.event, (chunk) => {
              if ((chunk = process(chunk))) {
                 // Concat new chunks + buffered content together.
                 this.buffer = Buffer.concat([this.buffer, chunk], this.buffer.length + chunk.length);
              }
           }).on('end', () => {
              // Flush the data, buffer and generate a new Promise.
              if (options.flush && this._Promise) {
                 this._Promise.then(() => {
                    this.flush();
                 });
              }
              try {
                  // Convert the buffer to utf-8, run trim() if options.trim is true.
                  this.data = this.buffer.toString('utf-8', 0)[options.trim?'trim':'toString']();
                  // If no data found reject if options.empty is false, otherwise resolve.
                  if ((!this.data || this.data.length === 0) && !options.empty) {
                     this._reject(new Error((options.message || 'Returned string is empty.')));
                   } else {
                     this._resolve(this.data);
                  }
                } catch (error) {
                  this._reject(error);
              }
          });
          // Add error event listeners to both the emitter and pipe if available.
          [emitter, (options.pipe ? emitter[options.pipe] : { on: () => {} })].forEach((obj) => {
              obj.on('error', (error) => {
                  this._reject(error);
              });
          });
      }

      // Get the current promise or reject if none is found.
      get Promise () {
          return (this._Promise ? this._Promise : Promise.reject('No Promise found.'));
      }

      // Create a (new) Promise, overwriting any existing one.
      // XXX: A callback to generate a promise!? This can be done better.
      addPromise (cb = () => { }) {
          this._Promise = new Promise((resolve, reject) => {
              this._resolve = resolve;
              this._reject = reject;
              cb.call(this, this._Promise);
          });

          return this;
      }

      // Getter/setter for this.data
      get data () {
          return (this._data ? this._data : '');
      }
      set data (str) {
          this._data = (!(!str || str.length === 0) ? str : false);
      }

      // Clear data, buffer, and generate a new Promise (if true).
      flush (clearPromise = true) {
          this.data = false;
          this.buffer = Buffer.alloc(0);
          return (clearPromise ? this.addPromise() : this);
      }
}

/*
 * Export the module for use!
 */
module.exports = DataFactory;
