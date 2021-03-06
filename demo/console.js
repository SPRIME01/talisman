"use strict";

const talisman = require("../lib/talisman");
const path = require("path");
const fs = require("fs");
const ReadableStream = require("stream").Readable;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Create a view
talisman.create(path.join(__dirname, "/console.html"))
    .then(view => {

        // Masks allow content to be transformed at run-time
        view.addMask("lowercase", s => s.toLowerCase());
        view.addMask("plusplus", i => i + 1);

        // Masks can be scoped to a block
        view.addMask("uppercase", s => s.toUpperCase(), "list");

        // Variables values can be promises
        view.set({
            title: "Talisman console demo",
            pageTitle: delay(5000).then(() => "Welcome to the Talisman console demo")
        }).set({
            html: "<strong>API calls can be chained</strong>"
        });

        // Variables can be streams
        const streamedContent = fs.createReadStream(path.join(__dirname, "../LICENSE"));
        view.set({streamedContent});

        // External files can be loaded into variables as new blocks
        return view.load(path.join(__dirname, "/external.html"), "externalContent");

    }).then(view => {

        // Iterators can be promises
        const data = delay(500).then(() => {

            if (Math.random() > 0.7) {
                throw new Error("Sometimes things fail");
            }

            return [
                {label: "If"},
                {label: "you"},
                {label: "wish"},
                {label: "to"},
                {label: "make"},
                {label: "an"},
                {label: "apple pie"},
                {label: "from"},
                {label: "scratch"}
            ];

        }).then(data => {

            // Remove the error if its ok
            view.remove("nolist");
            return data;

        }).catch(e => {

            // Remove the list if it fails
            view.remove("list");
            view.set({errorMessage: e.message});
        });

        view.waitUntil(data, "list").setIterator(data, "list:row");

        // Iterators can be object streams
        const source = [{name: "Object"}, {name: "Streams"}, {name: "FTW"}];
        const stream = new ReadableStream({objectMode: true});
        stream._read = function () {
            if (source.length === 0) {
                return this.push(null);
            }
            this.push(source.shift());
        };

        view.setIterator(stream, "externalContent:row");

        // Output as a stream
        return view.toStream();
    })
    .then(output => {
        output.on("error", e => console.error(e))
            .pipe(process.stdout);
    })
    .catch(e => console.error(e.stack));
