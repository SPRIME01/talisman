/*jslint node, es6, maxlen: 120 */

'use strict';
// jquery-like api for navigating the dom of html generated by the templating engine
const dom = require("cheerio");
const escapeHtml = require("escape-html");
const promisify = require("es6-promisify");
const readFile = promisify(require('fs').readFile);
const path = require("path");
const stream = require("stream");

const template = require("../lib/talisman").testMode(); //testMode() exposes private implementation methods
const priv = template.testFunctions; // easier access to private implementation methods

// Read the template file
const htmlPromise = readFile(path.join(__dirname, "testTemplate.html"), 'utf8');
// read a file full of random strings
const randomPromise = readFile(path.join(__dirname, "random.html"), 'utf8');

function contentParsingTest(test) {
    test.expect(12);

    const testContent = function (inputString, regexType) {
        // Parse the file for blocks
        const contentArray = priv.parseForTags(inputString, priv[regexType], []);

        test.ok(Array.isArray(contentArray), "Result is an array");

        // Test that the array is correctly formatted
        let contentTypesOk = true;
        let contentObjectsOk = true;
        contentArray.forEach(function (element) {
            if (typeof element !== 'string' && typeof element !== 'object') {
                contentTypesOk = false;
            }
            if (typeof element === 'object') {
                //Determine whether we are testing for a block or a variable tag based on the regex
                if (regexType === 'blockRegex' && (!element.name || !element.text || !element.content)) {
                    contentObjectsOk = false;
                }
                if (regexType === 'blockRegex' && element.content) {
                    if (!Array.isArray(element.content)) {
                        contentObjectsOk = false;
                    }
                }
                if (regexType === 'tagRegex' && (!element.name || !element.text || element.content)) {
                    contentObjectsOk = false;
                }
                if (regexType === 'tagRegex' && element.content) {
                    contentObjectsOk = false;
                }
            }
        });
        test.ok(contentTypesOk, "Array contains only strings and objects.");
        test.ok(contentObjectsOk, "Objects in the array are correctly formatted.");
    };
    // Test the function on the valid html template
    htmlPromise.then(function (templateString) {
        testContent(templateString, 'blockRegex');
        testContent(templateString, 'tagRegex');
    }).catch(function (err) {
        console.error(err);
    });
    // Test the function on a file full of random strings.
    randomPromise.then(function (templateString) {
        testContent(templateString, 'blockRegex');
        testContent(templateString, 'tagRegex');
    }).catch(function (err) {
        console.error(err);
    });

    Promise.all([htmlPromise, randomPromise]).then(function () {
        test.done();
    });
}



function templateInterfaceTest(test) {
    // Establish that the correct methods are exposed in the API
    const expectedTemplateMethods = [
        "load",
        "debug",
        "showUndefined"
    ];

    test.expect(expectedTemplateMethods.length);

    expectedTemplateMethods.forEach(function (method) {
        test.ok(template[method]);
    });
    test.done();
}

template.debug(false);
function invalidTemplateTest(test) {
    const invalidTemplate = template.load('invalid');

    // Rendering an invalid template will result in an error being sent to the browser
    let htmlResult = '';
    invalidTemplate.render()
        .on('data', function (chunk) {
            htmlResult += chunk.toString();
        })
        .on('end', function () {
            // Check that the string being sent to the browser contains the word 'Error'
            test.expect(1);
            test.ok(htmlResult.indexOf('Error') !== -1);
            test.done();
        });
}

const testFile = path.join(__dirname, "testTemplate.html");


function validTemplateTest(test) {
    // Establish that the correct methods are exposed within the context of the template
    const expectedContextMethods = [
        "load",
        "error",
        "set",
        "showUndefinedBlock",
        "remove",
        "restore",
        "addMask",
        "render",
        "test"
    ];

    // Set template path to current directory so that we can correctly retrieve
    const testTemplate = template.load(testFile);

    test.expect(expectedContextMethods.length + 1);
    expectedContextMethods.forEach(function (method) {
        test.ok(testTemplate[method]);
    });
    let htmlResult = '';
    testTemplate.render()
        .on('data', function (chunk) {
            htmlResult += chunk.toString();
        })
        .on('end', function () {
            const $ = dom.load(htmlResult);
            test.ok($('html').html());
            test.done();
        });
}

function testPage(test) {

    const testTemplate = template.load(testFile);

    const testString1 = "Test String";
    const testNumber1 = 7790.25;
    const testArray1 = ["Melons", "Apples", "Bananas", "Oranges", "Plums"];
    const testObject1 = {testKey1: "value1", testKey2: "value2"};
    const testPromise1Text = "This text was returned from a promise";
    const testPromise1 = new Promise(function (resolve) {
        setTimeout(resolve, 500, testPromise1Text);
    });

    const dummyReadMethod = function () {
        // It is necessary to define a _read function for the stream, however in our implementation we are pushing
        // items onto the stream directly so this function is not needed. If this function is not defined then you will
        // be spammed with 'not implemented' errors.
        return undefined;
    };

    const testReadableStream1 = new stream.Readable();
    const readableMessage = "This text was arrived via a Readable Stream.";
    testReadableStream1._read = dummyReadMethod; // _read is a bad property name according to JSLint
    testReadableStream1.push(readableMessage);
    testReadableStream1.push(null);
    const testDuplexStream1 = new stream.Duplex();
    const duplexMessage = "This text was arrived via a Duplex Stream.";
    testDuplexStream1._read = dummyReadMethod; // _read is a bad property name according to JSLint
    testDuplexStream1.push(duplexMessage);
    testDuplexStream1.push(null);
    const testTransformStream1 = new stream.Transform();
    const transformMessage = "This text was arrived via a Transform Stream.";
    testTransformStream1._read = dummyReadMethod; // _read is a bad property name according to JSLint
    testTransformStream1.push(transformMessage);
    testTransformStream1.push(null);

    const testFunction1 = function () {
        return "Function Returned";
    };



    /**
    * set() function testing
    */

    const setErrors = [];

    const trySetWithType = function (arg1, arg2) {
        try {
            testTemplate.set(arg1, arg2);
        } catch (ignore) {
            setErrors.push([typeof arg1, arg2]);
        }
    };
    // try the set function with no parameters
    trySetWithType();
    // Test all variable types by trying to assign using one argument. Most should fail
    trySetWithType(undefined);  // should fail
    trySetWithType(null);  // should fail
    trySetWithType(testString1); // should fail
    trySetWithType(testNumber1); // should fail
    trySetWithType(testArray1); // should fail
    trySetWithType(testPromise1); // should fail
    trySetWithType(testReadableStream1); // should fail
    trySetWithType(testDuplexStream1); // should fail
    trySetWithType(testTransformStream1); // should fail
    trySetWithType(testFunction1); // should fail
    trySetWithType(testObject1); // key:value pair object should succeed.

    // Test all variable types by trying to assign using two arguments. All should succeed.
    trySetWithType(undefined, "templateTestUndefined1");
    trySetWithType(testString1, "templateTestString1");
    trySetWithType(testNumber1, "templateTestNumber1");
    trySetWithType(testArray1, "templateTestArray1");
    trySetWithType(testObject1, "templateTestObject1");
    trySetWithType(testPromise1, "templateTestPromise1");
    trySetWithType(testReadableStream1, "templateTestReadableStream1");
    trySetWithType(testDuplexStream1, "templateTestDuplexStream1");
    trySetWithType(testTransformStream1, "templateTestTransformStream1");
    trySetWithType(testFunction1, "templateTestFunction1");

    /**
    * showUndefinedBlock() function testing
    */
    const showUndefinedBlockErrors = [];

    const tryShowWithType = function (arg1, arg2) {
        try {
            testTemplate.showUndefinedBlock(arg1, arg2);
        } catch (ignore) {
            showUndefinedBlockErrors.push([typeof arg1, arg2]);
        }
    };
    // Attempt to use with all variable types
    tryShowWithType();
    tryShowWithType(undefined);
    tryShowWithType(null);
    tryShowWithType(testNumber1);
    tryShowWithType(testArray1);
    tryShowWithType(testPromise1);
    tryShowWithType(testReadableStream1);
    tryShowWithType(testDuplexStream1);
    tryShowWithType(testTransformStream1);
    tryShowWithType(testFunction1);
    tryShowWithType(testObject1);
    tryShowWithType(testString1); // The only one that should work
    tryShowWithType(testString1, false);

    console.log(testTemplate.test)

    testTemplate.showUndefinedBlock("escapedBlock");
    // Broken into multiple statements because JSLint doesn't like ES6 multi-line template strings
    let testHtml1 = `<marquee behavior="scroll" direction="left" `;
    testHtml1 += `style="color:#F00;background-color:#00F;font-size:30px;">`;
    testHtml1 += `This is some HTML</marquee>`;
    testTemplate.set(testHtml1, "templateTestHtml1");
    testTemplate.remove("removedBlock");
    const contactList = [
        {
            name: 'Bruce',
            age: 45,
            email: 'bruce@talismanTemplate.com'
        },
        {
            name: 'Jane',
            age: 31,
            email: 'jane@talismanTemplate.com'
        },
        {
            name: 'Steve',
            age: 22,
            email: 'steve@talismanTemplate.com'
        }
    ];
    testTemplate.set(contactList[0], 'profileBlock');
    testTemplate.set(contactList, 'contactsBlock');

    const deeplink1 = {
        level1: {
            level2: {
                level3: "boop"
            }
        }
    };
    testTemplate.set(deeplink1, 'deeplinkTest');

    if (test !== undefined) {
        // Begin testing
        let htmlResult = '';
        testTemplate.render()
            .on('data', function (chunk) {
                htmlResult += chunk.toString();
            })
            .on('end', function () {
                const $ = dom.load(htmlResult);

                // Expect as many tests as there are elements with the class 'test'
                const elementCount = $('.test').get().length;

                test.expect(elementCount + 2);
                test.ok(setErrors.length === 11, "bad set() functions should throw an error");
                test.ok(showUndefinedBlockErrors.length === 11, "bad showUndefinedBlock() should throw an error");

                test.ok($('#testVars1').text().trim() === testString1, "Renders a string");
                test.ok($('#testVars2').text().trim() === testNumber1.toString(), "Renders a number");
                test.ok($('#testVars3').text().trim() === JSON.stringify(testArray1), "Renders an array");
                test.ok($('#testVars4').text().trim() === JSON.stringify(testObject1), "Renders an object");
                test.ok($('#testVars5').text().trim() === testPromise1Text, "Renders a promise");
                test.ok($('#testVars6').text().trim() === readableMessage, "Renders a readable stream");
                test.ok($('#testVars7').text().trim() === duplexMessage, "Renders a duplex stream");
                test.ok($('#testVars8').text().trim() === transformMessage, "Renders a transform stream");
                test.ok($('#testVars9').text().trim() === testFunction1(), "Renders a value returned from a function");
                test.ok($('#testVars10').text().trim() === "", "Renders nothing");

                test.ok($('#testTags1').text().trim() === "{templateTestUndefined1}", "Renders the tag itself");
                test.ok($('#testTags2').text().trim() === "", "Renders nothing");
                test.ok($('#testTags3').html().trim() === testHtml1, "Renders unfiltered HTML");
                test.ok($('#testTags4').html().trim() === escapeHtml(testHtml1), "render escaped html");

                test.ok(
                    $('#testBlocks1').text().trim() === "This is a static block with no variables associated with it.",
                    "Static blocks render correctly"
                );
                test.ok($('#testBlocks2').text().trim() === "", "Renders nothing");
                test.ok($('#profileEmail').text().trim() === contactList[0].email, "Static blocks render correctly");
                test.ok($('#testBlocks4').find('.iteratedRow').length === contactList.length, "iterable blocks work");
                test.ok($('#testBlocks5').text().trim() === contactList[1].email, "Renders the email address");
                test.ok(
                    $('#testBlocks6').text().trim() === deeplink1.level1.level2.level3,
                    "Renders the deeplinked variable"
                );

                test.done();
            });
    } else {
        // If this function is not being used by the test suite, then return the template
        // so that it can be rendered.
        return testTemplate;
    }
}
module.exports = {
    contentParsingTest,
    templateInterfaceTest,
    invalidTemplateTest,
    validTemplateTest,
    testPage
};
